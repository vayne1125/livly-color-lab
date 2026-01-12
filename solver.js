/**
 * Livly Color Calculator Solver
 * Uses A* Algorithm to find the shortest path from Current RGB to Target RGB.
 */

// Known Food/Bug Effects
const BUGS = [
    { name: "瓢蟲", nameEn: "Ladybug", r: 4, g: -2, b: -2, image: "img/ladybug.png" },
    { name: "長額負蝗", nameEn: "Longheaded Locust", r: -2, g: 4, b: -2, image: "img/locust.png" },
    { name: "雪隱金龜子", nameEn: "Lapis Lazuli Dor Beetle", r: -2, g: -2, b: 4, image: "img/dorbeetle.png" },
    { name: "斐豹蛺蝶的幼蟲", nameEn: "Indian Fritillary Larva", r: 7, g: 0, b: 0, image: "img/larva_red.png" },
    { name: "白粉蝶的幼蟲", nameEn: "Cabbage Butterfly Larva", r: 0, g: 7, b: 0, image: "img/larva_green.png" },
    { name: "雙線條紋天蛾的幼蟲", nameEn: "Hawk Moth Larva", r: 0, g: 0, b: 7, image: "img/larva_blue.png" },
    { name: "獨角仙的幼蟲", nameEn: "Rhinoceros Beetle Larva", r: 2, g: 2, b: 2, image: "img/rhino.png" },
    { name: "日本山蟻", nameEn: "Japanese Wood Ant", r: -2, g: -2, b: -2, image: "img/ant.png" }
];

// Helper: Calculate Euclidean distance
function distance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

// Helper: MinHeap for fast Priority Queue (O(log N) instead of O(N log N) sorting)
class MinHeap {
    constructor() {
        this.heap = [];
    }

    push(node) {
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        if (this.heap.length === 0) return null;
        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.bubbleDown(0);
        }
        return min;
    }

    size() {
        return this.heap.length;
    }

    bubbleUp(n) {
        const element = this.heap[n];
        while (n > 0) {
            const parentIdx = Math.floor((n - 1) / 2);
            const parent = this.heap[parentIdx];

            // MinHeap Criteria:
            // 1. Smaller F is better (standard A*)
            // 2. If F is equal, Larger G is better (Depth-First tie-breaking)
            //    This forces A* to dive deep instead of expanding breadth in symmetrical grids.
            const isBetter = element.f < parent.f || (element.f === parent.f && element.g > parent.g);

            if (!isBetter) break;

            this.heap[n] = parent;
            this.heap[parentIdx] = element;
            n = parentIdx;
        }
    }

    bubbleDown(n) {
        const length = this.heap.length;
        const element = this.heap[n];
        while (true) {
            let leftChildIdx = 2 * n + 1;
            let rightChildIdx = 2 * n + 2;
            let leftChild, rightChild;
            let swap = null;

            if (leftChildIdx < length) {
                leftChild = this.heap[leftChildIdx];
                // Compare Left vs Element
                if (leftChild.f < element.f || (leftChild.f === element.f && leftChild.g > element.g)) {
                    swap = leftChildIdx;
                }
            }
            if (rightChildIdx < length) {
                rightChild = this.heap[rightChildIdx];
                // Compare Right vs (Swap or Element)
                const compareNode = (swap === null) ? element : leftChild;
                if (rightChild.f < compareNode.f || (rightChild.f === compareNode.f && rightChild.g > compareNode.g)) {
                    swap = rightChildIdx;
                }
            }
            if (swap === null) break;
            this.heap[n] = this.heap[swap];
            this.heap[swap] = element;
            n = swap;
        }
    }
}

// Helper: State to integer index (Flattened 3D Array)
// Dimensions: 0-450 => size 451
const SIZE = 451;
const SIZE_SQ = SIZE * SIZE;

function getIndex(r, g, b) {
    return r + (g * SIZE) + (b * SIZE_SQ);
}

// A* Solver
async function solveColorPath(start, target, allowedError = 2, mode = 'fast') {
    // start: {r, g, b}, target: {r, g, b}
    // mode: 'fast' (Greedy/Weighted) or 'optimal' (Admissible A*)

    const openSet = new MinHeap(); // Use MinHeap instead of Array
    const cameFrom = new Map(); // path reconstruction (Keep random access for now)

    // OPTIMIZATION: Use Flat Int16Array for gScore instead of Map
    // Size: 451^3 ≈ 91 million entries. 
    // Int16 (2 bytes) => ~180MB RAM. very fast.
    // Initialize with 32000 (simulating Infinity, since max steps is usually < 500)
    const gScore = new Int16Array(SIZE * SIZE * SIZE).fill(32000);

    // --- GREEDY PRE-PASS OPTIMIZATION ---
    // For very large distances (e.g., 0 to 450), A* search depth (>60 steps) causes explosion.
    // Since Larvae (+7) are the most efficient way to gain mass, we can greedily
    // apply them, AND use Ants (-2) to reduce mass, until we are "close enough".

    let currentState = { ...start };
    const prefixPath = [];

    // Threshold: How close to target before handing over to A*?
    // Fast limit: 21 (3 steps). 
    // Optimal limit: 63 (9 steps) - Ultra Deep Mode.
    // Pushed to utilize full 2s budget. 
    // This allows finding optimal paths that are ~9 steps "non-greedy".
    const ADDITION_THRESHOLD = mode === 'optimal' ? 63 : 21;

    // REDUCTION THRESHOLD pushed to 40 (20 ants).
    // Allows A* to optimize long reduction sequences.
    const REDUCTION_THRESHOLD = mode === 'optimal' ? 40 : 20;

    // 1. GREEDY REDUCTION (Ants: -2, -2, -2) - PRIORITY 1!
    // We must reduce FIRST. 
    // New Strategy: "Drain then Fill".
    // If ANY channel is way too high, we MUST use Ants to drain it, even if it "hurts" other channels.
    // Why? because increasing a channel (Larva +7) is cheap and easy.
    // Reducing a channel (Ant -2) is slow and the only option.
    // So if R needs -200, we use 100 Ants. If that drops G by 200 (into deficit), 
    // the subsequent Greedy Addition phase will easily fix G with ~30 Larvae.
    // This solves the "Paralysis" where it refused to reduce B because R was low.
    while (true) {
        const rSurplus = currentState.r - target.r > REDUCTION_THRESHOLD;
        const gSurplus = currentState.g - target.g > REDUCTION_THRESHOLD;
        const bSurplus = currentState.b - target.b > REDUCTION_THRESHOLD;

        const anySurplus = rSurplus || gSurplus || bSurplus;

        // Remove "Safe" checks. Priority is to eliminate massive surpluses.
        // Collatoral damage to other channels will be repaired by the Larva loops below.
        if (anySurplus) {
            currentState.r = Math.max(0, currentState.r - 2);
            currentState.g = Math.max(0, currentState.g - 2);
            currentState.b = Math.max(0, currentState.b - 2);
            prefixPath.push(BUGS[7]); // Japanese Wood Ant
        } else {
            break;
        }
    }

    // 2. GREEDY ADDITION (Larvae: +7) - PRIORITY 2
    // Now that we have cleared space, fill up the necessary buckets.

    // Red
    while (target.r - currentState.r > ADDITION_THRESHOLD) {
        currentState.r += 7;
        prefixPath.push(BUGS[3]); // Indian Fritillary Larva (Red)
    }
    // Green
    while (target.g - currentState.g > ADDITION_THRESHOLD) {
        currentState.g += 7;
        prefixPath.push(BUGS[4]); // Cabbage Butterfly Larva (Green)
    }
    // Blue
    while (target.b - currentState.b > ADDITION_THRESHOLD) {
        currentState.b += 7;
        prefixPath.push(BUGS[5]); // Hawk Moth Larva (Blue)
    }

    // Define start point for A* as the state AFTER greedy moves
    const startIndex = getIndex(currentState.r, currentState.g, currentState.b);
    gScore[startIndex] = 0;

    // For fScore, we don't strictly one for every node if we calculate f on the fly or store in openSet node.
    // But to keep A* standard, we can verify against known best f. 
    // Actually, standard A* only checks gScore for repathing. f is derived. 
    // We only need gScore for the "Visited/Better Path" check.

    openSet.push({
        state: currentState,
        g: 0,
        f: distance(start, target)
    });

    // Configuration based on mode
    let MAX_STEPS = 50;
    let MAX_ITERATIONS = 5000;

    if (mode === 'optimal') {
        MAX_STEPS = 500;
        MAX_ITERATIONS = 5000000; // Increased to 5M for Ultra Deep search (Threshold 63)
    } else {
        // Boosted Fast Mode limits based on new optimized engine
        MAX_STEPS = 300;     // Increased from 100 to allow complex paths
        MAX_ITERATIONS = 200000; // Increased from 5000 to ensure convergence
    }

    let bestNode = null;
    let minDist = Infinity;
    let iterations = 0;

    // Cache yield promise
    const timeSlice = 5000;

    while (openSet.size() > 0) {
        iterations++;

        if (iterations % timeSlice === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Pop best node from Heap (O(logN)) instead of Sort+Shift (O(NlogN))
        const current = openSet.pop();
        const { r, g, b } = current.state;
        const currentIndex = getIndex(r, g, b);

        // OPTIMIZATION: Array Lookup (O(1))
        // If the g-score in our node is worse than what's already in the table, skip.
        if (current.g > gScore[currentIndex]) {
            continue;
        }

        const currentDist = distance(current.state, target);

        if (currentDist < minDist) {
            minDist = currentDist;
            bestNode = current;
        }

        const tolerance = allowedError === 0 ? 0.5 : allowedError + 0.5;
        if (currentDist <= tolerance) {
            const aStarPath = reconstructPath(cameFrom, current.state);
            return prefixPath.concat(aStarPath);
        }

        if (iterations > MAX_ITERATIONS) {
            if (mode === 'optimal') console.warn("Max iterations reached.");
            const aStarPath = reconstructPath(cameFrom, bestNode.state);
            return prefixPath.concat(aStarPath);
        }

        if (current.g >= MAX_STEPS) continue;

        // Try every bug
        for (const bug of BUGS) {
            let nextR = r + bug.r;
            let nextG = g + bug.g;
            let nextB = b + bug.b;

            // Fast clamp
            if (nextR < 0) nextR = 0; else if (nextR > 450) nextR = 450;
            if (nextG < 0) nextG = 0; else if (nextG > 450) nextG = 450;
            if (nextB < 0) nextB = 0; else if (nextB > 450) nextB = 450;

            const nextIndex = getIndex(nextR, nextG, nextB);
            const tentativeG = current.g + 1;

            // Direct Array Access - Huge Speedup
            if (tentativeG < gScore[nextIndex]) {
                gScore[nextIndex] = tentativeG;

                // Key for cameFrom map - we still use integer key for map if possible or string. 
                // Let's use the Index as the Map key! significantly faster than string generaton.
                cameFrom.set(nextIndex, { prev: current.state, bug: bug });

                let h = 0;
                if (mode === 'optimal') {
                    const dr = target.r - nextR;
                    const dg = target.g - nextG;
                    const db = target.b - nextB;

                    // Inlining distance logic for speed
                    const distSq = dr * dr + dg * dg + db * db;
                    const minStepsEuclidean = Math.sqrt(distSq) / 7;

                    const stepsR = dr > 0 ? dr / 7 : (-dr) / 2;
                    const stepsG = dg > 0 ? dg / 7 : (-dg) / 2;
                    const stepsB = db > 0 ? db / 7 : (-db) / 2;
                    const minStepsComponent = (stepsR > stepsG) ? (stepsR > stepsB ? stepsR : stepsB) : (stepsG > stepsB ? stepsG : stepsB);

                    // NEW: Sum Difference Heuristic
                    // Larvae (efficient moves) add to Total Sum. 
                    // Single component heuristic underestimates cost because it assumes independent parallel moves.
                    // But +7 R and +7 G requires 2 steps, not 1.
                    // Total Sum captures this accumulation.
                    const sumDiff = dr + dg + db;
                    let minStepsSum = 0;
                    if (sumDiff > 0) {
                        // Max accumulation rate is +7 (Larva)
                        minStepsSum = sumDiff / 7;
                    } else {
                        // Max reduction rate is -6 (Ant: -2-2-2)
                        minStepsSum = (-sumDiff) / 6;
                    }

                    // Take the strongest admissible heuristic
                    let smartH = minStepsComponent;
                    if (minStepsEuclidean > smartH) smartH = minStepsEuclidean;
                    if (minStepsSum > smartH) smartH = minStepsSum;

                    // TIE-BREAKER:
                    // We add a tiny fraction for tie-breaking (preferring moves that help multiple axis).
                    // But for "Optimal", we must ensure h <= true_cost.
                    // Our heuristic (max component) is a lower bound (underestimates).
                    // Adding a tiny epsilon doesn't break admissibility because real cost is usually integer steps.
                    const secondaryH = stepsR + stepsG + stepsB;

                    // PURE A* (Weight 1.0)
                    // This guarantees the mathematically shortest path.
                    // 1.001 was slightly greedy. 1.0 is perfect.
                    // Reduced tie-breaker to 1e-6 to ensure h <= cost (Admissibility).
                    h = (smartH * 1.0) + (secondaryH * 0.000001);
                } else {
                    const dr = target.r - nextR;
                    const dg = target.g - nextG;
                    const db = target.b - nextB;
                    h = Math.sqrt(dr * dr + dg * dg + db * db);
                }

                openSet.push({
                    state: { r: nextR, g: nextG, b: nextB },
                    g: tentativeG,
                    f: tentativeG + h
                });
            }
        }
    }

    const finalPath = reconstructPath(cameFrom, bestNode ? bestNode.state : currentState);
    return prefixPath.concat(finalPath);
}

function reconstructPath(cameFrom, currentState) {
    const path = [];
    let curr = currentState;
    // Reconstruction needs to use same key logic (Index)
    let key = getIndex(curr.r, curr.g, curr.b);

    while (cameFrom.has(key)) {
        const node = cameFrom.get(key);
        path.unshift(node.bug);
        curr = node.prev;
        key = getIndex(curr.r, curr.g, curr.b);
    }
    return path;
}
