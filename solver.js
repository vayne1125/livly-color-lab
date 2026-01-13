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

// --- Global Static Memory (Prevents OOM/GC during benchmarks) ---
const SIZE_CUBED = SIZE * SIZE * SIZE;
const G_SCORE_CACHE = new Int16Array(SIZE_CUBED);
const SESSION_CACHE = new Uint16Array(SIZE_CUBED); // Marks which session visited which node
let GLOBAL_SESSION_ID = 0;

// A* Solver
async function solveColorPath(start, target, allowedError = 2, mode = 'fast') {
    GLOBAL_SESSION_ID++;
    // If sessions overflow, reset everything
    if (GLOBAL_SESSION_ID >= 65535) {
        GLOBAL_SESSION_ID = 1;
        SESSION_CACHE.fill(0);
    }

    const openSet = new MinHeap();
    const cameFrom = new Map();

    let currentState = { ...start };
    const prefixPath = [];

    function applyBug(bug) {
        currentState.r = Math.max(0, Math.min(450, currentState.r + bug.r));
        currentState.g = Math.max(0, Math.min(450, currentState.g + bug.g));
        currentState.b = Math.max(0, Math.min(450, currentState.b + bug.b));
        prefixPath.push(bug);
    }

    // For Optimal Mode, we want to handover to A* ASAP (large threshold)
    // so A* can optimize the bulk of the path.
    // 77 was too tight (Hatena beat us). 200 was too loose (A* Timeout).
    // 120 is the sweet spot (~17 steps).
    const ADDITION_THRESHOLD = mode === 'optimal' ? 120 : 35;
    const REDUCTION_THRESHOLD = mode === 'optimal' ? 120 : 35;

    // 1. SMART GREEDY REDUCTION & MIXED OPTIMIZATION
    while (true) {
        // Deltas: Target - Current (Positive = Needs Increase, Negative = Needs Decrease)
        const dr = target.r - currentState.r;
        const dg = target.g - currentState.g;
        const db = target.b - currentState.b;

        let actionTaken = false;

        // --- PRIORITY 0: GOD MOVES (One stone, two/three birds) ---
        // Check basic bugs (Ladybug, Locust, DorBeetle) to see if they perfectly align with needs.
        // Ladybug (0): +4, -2, -2. Useful if: Need R+, Need G-, Need B-
        // Locust (1): -2, +4, -2. Useful if: Need R-, Need G+, Need B-
        // DorBeetle (2): -2, -2, +4. Useful if: Need R-, Need G-, Need B+

        // Threshold for "God Moves" can be lower, we just want direction correctness
        const ALIGN_THRESHOLD = 5;

        if (dr > ALIGN_THRESHOLD && dg < -ALIGN_THRESHOLD && db < -ALIGN_THRESHOLD) {
            applyBug(BUGS[0]); actionTaken = true; // Ladybug
        } else if (dr < -ALIGN_THRESHOLD && dg > ALIGN_THRESHOLD && db < -ALIGN_THRESHOLD) {
            applyBug(BUGS[1]); actionTaken = true; // Locust
        } else if (dr < -ALIGN_THRESHOLD && dg < -ALIGN_THRESHOLD && db > ALIGN_THRESHOLD) {
            applyBug(BUGS[2]); actionTaken = true; // Dor Beetle
        }

        // --- HATENA STRATEGY: SUM-BASED REDUCTION ---
        // Moved back to Priority 0.5 (After God Moves, Before Loose Alignment?)
        // Actually, let's put it back to where it was useful but safe.
        // Rule: If God Moves failed, AND we are massively overweight, then nuke.
        const totalMassDiff = dr + dg + db;
        if (!actionTaken && totalMassDiff < -100) { // Threshold changed to -100
            applyBug(BUGS[7]);
            actionTaken = true;
        }

        // Loose Alignment (2 out of 3 match, 3rd is neutral/small/acceptable sacrifice)
        // We added checks for (R+, B-) and (G+, B-) and (B+, G-) which were missing.
        if (!actionTaken) {
            const MAJOR_DIFF = 40;
            // Ladybug (+R, -G, -B)
            if (dr > MAJOR_DIFF && dg < -MAJOR_DIFF) { applyBug(BUGS[0]); actionTaken = true; }
            else if (dr > MAJOR_DIFF && db < -MAJOR_DIFF) { applyBug(BUGS[0]); actionTaken = true; } // NEW: R+, B-

            // Locust (-R, +G, -B)
            else if (dg > MAJOR_DIFF && dr < -MAJOR_DIFF) { applyBug(BUGS[1]); actionTaken = true; }
            else if (dg > MAJOR_DIFF && db < -MAJOR_DIFF) { applyBug(BUGS[1]); actionTaken = true; } // NEW: G+, B-

            // Dor Beetle (-R, -G, +B)
            else if (db > MAJOR_DIFF && dr < -MAJOR_DIFF) { applyBug(BUGS[2]); actionTaken = true; }
            else if (db > MAJOR_DIFF && dg < -MAJOR_DIFF) { applyBug(BUGS[2]); actionTaken = true; } // NEW: B+, G-
        }

        if (actionTaken) {
            // Re-evaluate loop
            continue;
        }

        // --- PRIORITY 1: SAFE MACROS (Preserve other channels) ---
        // Calc Surplus (Current - Target) for Reduction Logic
        const surR = currentState.r - target.r;
        const surG = currentState.g - target.g;
        const surB = currentState.b - target.b;

        const rs = surR > REDUCTION_THRESHOLD;
        const gs = surG > REDUCTION_THRESHOLD;
        const bs = surB > REDUCTION_THRESHOLD;

        if (rs && gs && bs) applyBug(BUGS[7]);
        else if (rs && gs) { applyBug(BUGS[2]); applyBug(BUGS[7]); applyBug(BUGS[7]); }
        else if (gs && bs) { applyBug(BUGS[0]); applyBug(BUGS[7]); applyBug(BUGS[7]); }
        else if (rs && bs) { applyBug(BUGS[1]); applyBug(BUGS[7]); applyBug(BUGS[7]); }
        else if (rs) { applyBug(BUGS[1]); applyBug(BUGS[2]); applyBug(BUGS[7]); }
        else if (gs) { applyBug(BUGS[0]); applyBug(BUGS[2]); applyBug(BUGS[7]); }
        else if (bs) { applyBug(BUGS[0]); applyBug(BUGS[1]); applyBug(BUGS[7]); }
        else break;
    }

    // 2. GREEDY ADDITION
    while (target.r - currentState.r > ADDITION_THRESHOLD) applyBug(BUGS[3]);
    while (target.g - currentState.g > ADDITION_THRESHOLD) applyBug(BUGS[4]);
    while (target.b - currentState.b > ADDITION_THRESHOLD) applyBug(BUGS[5]);

    const startIndex = getIndex(currentState.r, currentState.g, currentState.b);
    G_SCORE_CACHE[startIndex] = 0;
    SESSION_CACHE[startIndex] = GLOBAL_SESSION_ID;

    // Unified Heuristic Function (Admissible Lower Bound)
    function getH(r, g, b) {
        const dr = target.r - r; const dg = target.g - g; const db = target.b - b;
        const adr = Math.abs(dr); const adg = Math.abs(dg); const adb = Math.abs(db);

        // Max component progress (+7 or -2 / -6 combo)
        const stepsR = dr > 0 ? adr / 7 : adr / 2;
        const stepsG = dg > 0 ? adg / 7 : adg / 2;
        const stepsB = db > 0 ? adb / 7 : adb / 2;
        const minStepsComponent = Math.max(stepsR, stepsG, stepsB);

        // Sum difference progress
        const sumDiff = dr + dg + db;
        const minStepsSum = sumDiff > 0 ? sumDiff / 7 : (-sumDiff) / 6;

        // Take max of the lower bounds
        const smartH = Math.max(minStepsComponent, minStepsSum, Math.sqrt(dr * dr + dg * dg + db * db) / 7);

        // PURE A* vs WEIGHTED A*
        // Optimal: Weight 1.0 (Pure A*) guarantees shortest path.
        // Fast: Weight 1.02 (Slightly Greedy) fits browser limits.
        // Even 1.02 can accumulate errors in 200-step paths (1.02^170 = 29x error).
        // So for Optimal, we MUST use 1.0 to beat Hatena's rule-based logic.
        const weight = mode === 'optimal' ? 1.0 : 1.02;

        // Tie-breaker 1: Prefer moves reducing total Manhattan distance (Standard)
        const manhattan = adr + adg + adb;

        // Tie-breaker 2: Mass Balance (New!)
        // Encourage keeping the Total Mass (R+G+B) close to Target Mass.
        // Penalty is tiny (0.000001 range) to not break admissibility rules if weight=1.
        const totalMassDiff = dr + dg + db; // Re-calculate or use from scope? It is in scope.
        const massPenalty = Math.abs(totalMassDiff) * 0.000001;

        const secondaryH = (manhattan * 0.000001) + massPenalty;

        return (smartH * weight) + secondaryH;
    }

    openSet.push({
        state: { ...currentState },
        g: 0,
        f: getH(currentState.r, currentState.g, currentState.b)
    });

    // Extremely high iteration limit for Optimal to ensure it finishes the expanded search space (radius 42)
    let MAX_ITERATIONS = mode === 'optimal' ? 5000000 : 500000;
    let MAX_STEPS = mode === 'optimal' ? 500 : 400;

    let bestNode = null;
    let minDist = Infinity;
    let iterations = 0;

    while (openSet.size() > 0) {
        iterations++;
        if (iterations % 10000 === 0) await new Promise(r => setTimeout(r, 0));

        const current = openSet.pop();
        const { r, g, b } = current.state;
        const idx = getIndex(r, g, b);

        if (SESSION_CACHE[idx] === GLOBAL_SESSION_ID && current.g > G_SCORE_CACHE[idx]) continue;

        const d = distance(current.state, target);
        if (d < minDist) { minDist = d; bestNode = current; }

        if (d <= (allowedError === 0 ? 0.3 : allowedError + 0.3)) {
            return prefixPath.concat(reconstructPath(cameFrom, current.state));
        }

        if (iterations > MAX_ITERATIONS) break;
        if (current.g >= MAX_STEPS) continue;

        for (const bug of BUGS) {
            let nr = r + bug.r; let ng = g + bug.g; let nb = b + bug.b;
            if (nr < 0) nr = 0; else if (nr > 450) nr = 450;
            if (ng < 0) ng = 0; else if (ng > 450) ng = 450;
            if (nb < 0) nb = 0; else if (nb > 450) nb = 450;

            const nIdx = getIndex(nr, ng, nb);
            const ngScore = current.g + 1;

            if (SESSION_CACHE[nIdx] !== GLOBAL_SESSION_ID || ngScore < G_SCORE_CACHE[nIdx]) {
                G_SCORE_CACHE[nIdx] = ngScore;
                SESSION_CACHE[nIdx] = GLOBAL_SESSION_ID;
                cameFrom.set(nIdx, { prev: { r, g, b }, bug });
                openSet.push({
                    state: { r: nr, g: ng, b: nb },
                    g: ngScore,
                    f: ngScore + getH(nr, ng, nb)
                });
            }
        }
    }

    const finalPath = reconstructPath(cameFrom, bestNode ? bestNode.state : currentState);
    return prefixPath.concat(finalPath);
}

function reconstructPath(cameFrom, targetState) {
    // ... (Existing implementation) ...
    const path = [];
    let curr = targetState;
    let key = getIndex(curr.r, curr.g, curr.b);
    let protection = 0;
    while (cameFrom.has(key) && protection < 1000) {
        const node = cameFrom.get(key);
        path.unshift(node.bug);
        curr = node.prev;
        key = getIndex(curr.r, curr.g, curr.b);
        protection++;
    }
    return path;
}
