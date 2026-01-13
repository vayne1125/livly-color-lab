/* global BUGS, solveColorPath */
// Scripts are now loaded globally in index.html, no import needed

document.addEventListener('DOMContentLoaded', () => {
    // Inputs
    const currentInputs = {
        r: document.getElementById('cur-r'),
        g: document.getElementById('cur-g'),
        b: document.getElementById('cur-b')
    };
    const currentRanges = {
        r: document.getElementById('cur-r-range'),
        g: document.getElementById('cur-g-range'),
        b: document.getElementById('cur-b-range')
    };

    const targetInputs = {
        r: document.getElementById('tar-r'),
        g: document.getElementById('tar-g'),
        b: document.getElementById('tar-b')
    };
    const targetRanges = {
        r: document.getElementById('tar-r-range'),
        g: document.getElementById('tar-g-range'),
        b: document.getElementById('tar-b-range')
    };

    const calcBtn = document.getElementById('calc-btn');
    const resultSection = document.getElementById('result-section');
    const solutionList = document.getElementById('solution-list');
    const totalSummary = document.getElementById('total-summary');
    const errorMsg = document.getElementById('error-msg');

    // Restore DOM elements
    const currentPreview = document.getElementById('current-preview');
    const targetPreview = document.getElementById('target-preview');

    function updatePreviews() {
        const curR = parseInt(currentInputs.r.value) || 0;
        const curG = parseInt(currentInputs.g.value) || 0;
        const curB = parseInt(currentInputs.b.value) || 0;

        const tarR = parseInt(targetInputs.r.value) || 0;
        const tarG = parseInt(targetInputs.g.value) || 0;
        const tarB = parseInt(targetInputs.b.value) || 0;

        // Sync Ranges (just in case called from calculation or load)
        // Note: Avoid cyclic updates if already correct? Browser handles value assignment efficiently.
        currentRanges.r.value = curR;
        currentRanges.g.value = curG;
        currentRanges.b.value = curB;
        targetRanges.r.value = tarR;
        targetRanges.g.value = tarG;
        targetRanges.b.value = tarB;

        // 1. Update Circle Preview (Visible on Desktop)
        if (currentPreview) currentPreview.style.backgroundColor = `rgb(${curR}, ${curG}, ${curB})`;
        if (targetPreview) targetPreview.style.backgroundColor = `rgb(${tarR}, ${tarG}, ${tarB})`;

        // 2. Update Group Background Tint (Only used in CSS on Mobile)
        // We set a CSS variable so the stylesheet can decide when to use it
        // The transparency here (0.3) determines how strong the color tint is on mobile.
        document.getElementById('cur-r').closest('.input-group').style.setProperty('--group-bg', `rgba(${curR}, ${curG}, ${curB}, 0.5)`);
        document.getElementById('tar-r').closest('.input-group').style.setProperty('--group-bg', `rgba(${tarR}, ${tarG}, ${tarB}, 0.5)`);
    }

    // Initial update
    updatePreviews();

    // Sync Logic: Input <-> Range
    function setupSync(inputs, ranges) {
        ['r', 'g', 'b'].forEach(chan => {
            const numInput = inputs[chan];
            const rangeInput = ranges[chan];

            // Number -> Range
            numInput.addEventListener('input', () => {
                rangeInput.value = numInput.value;
                updatePreviews();
            });

            // Range -> Number
            rangeInput.addEventListener('input', () => {
                numInput.value = rangeInput.value;
                updatePreviews();
            });
        });
    }

    setupSync(currentInputs, currentRanges);
    setupSync(targetInputs, targetRanges);

    // Initial update
    updatePreviews();

    // Translation Dictionary
    const translations = {
        zh: {
            title: "Livly Color Lab",
            subtitle: "Mix Perfect Colors with Minimal Feeds",
            current_color: "當前顏色 (Current)",
            target_color: "目標顏色 (Target)",
            paste_instruction: "支援遊戲複製格式",
            allow_error: "允許誤差 ±2",
            calc_btn: "計算配方 (Calculate)", // fallback
            // calc_fast_btn: "標準計算 (快速)",
            // calc_optimal_btn: "深度計算 (省飼料)",
            calc_fast_btn: "標準計算",
            calc_optimal_btn: "最佳計算",
            calc_note: "※ 最佳計算可能需要較長時間，請耐心等待",
            calculating: "計算中...",
            recommended_menu: "飼料清單",
            error_msg: "無法找到完美的配方，請嘗試調整目標顏色或分階段進行。",
            success_msg: "顏色已經達到目標（或在允許誤差內）！",
            total_summary: "總共需要餵食 {n} 個飼料",
            enter_prompt: "請輸入顏色並點擊計算",
            paste_placeholder: "貼上 R100 G100 B100",
            visitor_prefix: "總瀏覽人次: ",
            // Modal Translations
            about_title: "關於本工具",
            about_desc_1: "本計算機由玩家自製，非官方維護。",
            about_desc_2: "演算法持續優化中，致力於尋找最省飼料的方案。",
            mode_explanation_title: "計算模式說明",
            mode_std_title: "⚡ 標準模式 (Standard)",
            mode_std_desc: "快速計算，適合大部分情況。",
            mode_deep_title: "🧠 最佳模式 (Optimal)",
            mode_deep_desc: "最佳模式 (約 1-3 秒)，平均可節省約 2 個飼料！雖然運算過程會盡力尋找最優的組合，但因組合極其龐大，結果僅供參考，無法保證絕對最優。",
            feedback_title: "回饋與建議",
            feedback_desc: "發現 Bug 或有更好的演算法想法？歡迎告訴我們！",
            send_btn: "送出回饋"
        },
        en: {
            title: "Livly Color Lab",
            subtitle: "Mix Perfect Colors with Minimal Feeds",
            current_color: "Current Color",
            target_color: "Target Color",
            paste_instruction: "Supports game copy format",
            allow_error: "Allow ±2 Error",
            calc_btn: "Calculate Recipe",
            calc_fast_btn: "Standard",
            calc_optimal_btn: "Optimal",
            calc_note: "* Optimal calc may take longer, please wait",
            calculating: "Calculating...",
            recommended_menu: "Feed List",
            error_msg: "Could not find a perfect recipe. Try adjusting target or doing it in steps.",
            success_msg: "Target color reached (within allowed error)!",
            total_summary: "Total fruits needed: {n}",
            enter_prompt: "Enter colors and click Calculate",
            paste_placeholder: "Paste R100 G100 B100",
            visitor_prefix: "Total Visits: ",
            // Modal Translations
            about_title: "About This Tool",
            about_desc_1: "Unofficial fan-made tool.",
            about_desc_2: "Algorithm is constantly optimized for efficiency.",
            mode_explanation_title: "Calculation Modes",
            mode_std_title: "⚡ Standard Mode",
            mode_std_desc: "Quick calculation. Suitable for most cases.",
            mode_deep_title: "🧠 Optimal Mode",
            mode_deep_desc: "Optimal Mode (~1-3s). Saves ~2 feeds on avg! We strive for the most efficient path, but due to the complexity, absolute optimality cannot be guaranteed.",
            feedback_title: "Feedback",
            feedback_desc: "Found a bug? Have a suggestion? Let us know!",
            send_btn: "Send Feedback"
        }
    };

    let currentLang = 'zh';

    const langBtn = document.getElementById('lang-btn');
    const infoBtn = document.getElementById('info-btn'); // New: Info Button
    const infoModal = document.getElementById('info-modal'); // New: Modal
    const closeModal = document.getElementById('close-modal'); // New: Close Button
    const sendFeedbackBtn = document.getElementById('send-feedback-btn'); // New: Send Button
    const feedbackText = document.getElementById('feedback-text');

    const pasteInput = document.getElementById('paste-input');
    const pasteInputTarget = document.getElementById('paste-input-target');
    const calcFastBtn = document.getElementById('calc-fast-btn');
    const calcOptimalBtn = document.getElementById('calc-optimal-btn');

    // --- Modal Logic ---
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            infoModal.classList.remove('hidden');
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            infoModal.classList.add('hidden');
        });
    }

    // Changelog Toggle
    const changelogBtn = document.getElementById('changelog-btn');
    const changelogContent = document.getElementById('changelog-content');
    if (changelogBtn && changelogContent) {
        changelogBtn.addEventListener('click', () => {
            changelogContent.classList.toggle('hidden');
        });
    }

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            infoModal.classList.add('hidden');
        }
    });

    // Feedback Logic (Mailto) - Removed in favor of Google Sheet Integration below

    // --- Persistence Logic ---
    function loadSavedState() {
        // Load colors
        const saved = JSON.parse(localStorage.getItem('livly_calc_state'));
        if (saved) {
            if (saved.current) {
                currentInputs.r.value = saved.current.r || 0;
                currentInputs.g.value = saved.current.g || 0;
                currentInputs.b.value = saved.current.b || 0;
            }
            if (saved.target) {
                targetInputs.r.value = saved.target.r || 0;
                targetInputs.g.value = saved.target.g || 0;
                targetInputs.b.value = saved.target.b || 0;
            }
            if (saved.allowedError !== undefined) {
                document.getElementById('allow-error').checked = saved.allowedError;
            }
        }
        updatePreviews();
    }

    // --- Google Sheet Feedback Integration ---
    // STEP: Paste your Web App URL here!
    const FEEDBACK_API_URL = "https://script.google.com/macros/s/AKfycbxQynPk9papbMc-vdkOwtDSFS7RbQJlY5fhCGbtwCDFoy_PmFfjAeruxNZ9w7P27ETn/exec";
    const visitorCountEl = document.getElementById('visitor-count');

    // Visitor Counter Logic (GET)
    if (FEEDBACK_API_URL && visitorCountEl) {
        fetch(FEEDBACK_API_URL)
            .then(response => response.json())
            .then(data => {
                const count = data.count || 0;
                const prefix = translations[currentLang].visitor_prefix;
                visitorCountEl.textContent = prefix + count;
                // Store count globally for lang switch
                window.currentVisitorCount = count;
            })
            .catch(e => {
                console.log("Visitor count fetch failed", e);
                visitorCountEl.style.display = 'none';
            });
    }

    // Feedback Logic (Google Sheet)
    if (sendFeedbackBtn) {
        sendFeedbackBtn.addEventListener('click', () => {
            const content = feedbackText.value.trim();
            if (!content) {
                alert(currentLang === 'zh' ? '請輸入內容' : 'Please enter content');
                return;
            }

            // Check if API URL is set
            if (!FEEDBACK_API_URL) {
                alert("請先設定 Google Sheet API URL (參見說明文件)");
                return;
            }

            // UI Loading State
            const originalText = sendFeedbackBtn.textContent;
            sendFeedbackBtn.textContent = currentLang === 'zh' ? '傳送中...' : 'Sending...';
            sendFeedbackBtn.disabled = true;

            // Send to Google Sheet
            // Note: 'no-cors' mode is required for Google Apps Script Web App simple POSTs
            // This means we won't get a readable JSON response, but it will work.
            fetch(FEEDBACK_API_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain" // Important: Avoids CORS preflight
                },
                body: JSON.stringify({ message: content })
            })
                .then(() => {
                    // Assume success (opaque response)
                    alert(currentLang === 'zh' ? '感謝您的回饋！' : 'Thank you for your feedback!');
                    feedbackText.value = '';
                    infoModal.classList.add('hidden');
                })
                .catch(err => {
                    alert(currentLang === 'zh' ? '發送失敗，請稍後再試。' : 'Failed to send, please try again later.');
                })
                .finally(() => {
                    sendFeedbackBtn.textContent = originalText;
                    sendFeedbackBtn.disabled = false;
                });
        });
    }

    function saveState() {
        const state = {
            current: {
                r: currentInputs.r.value,
                g: currentInputs.g.value,
                b: currentInputs.b.value
            },
            target: {
                r: targetInputs.r.value,
                g: targetInputs.g.value,
                b: targetInputs.b.value
            },
            allowedError: document.getElementById('allow-error').checked
        };
        localStorage.setItem('livly_calc_state', JSON.stringify(state));
    }

    // Load on init
    loadSavedState();

    // Attach save to all inputs
    const allInputElements = [
        currentInputs.r, currentInputs.g, currentInputs.b,
        targetInputs.r, targetInputs.g, targetInputs.b,
        document.getElementById('allow-error')
    ];
    allInputElements.forEach(el => el.addEventListener('change', saveState));
    allInputElements.forEach(el => el.addEventListener('input', saveState)); // For slider/text real-time

    // Language Switcher
    langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'zh' ? 'en' : 'zh';
        updateLanguage();
    });
    // Init button text
    langBtn.textContent = currentLang === 'zh' ? 'EN' : '中';

    function updateLanguage() {
        // Update Button Text (Show target language)
        langBtn.textContent = currentLang === 'zh' ? 'EN' : '中';

        const t = translations[currentLang];

        // Update static text
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        // Update placeholders
        pasteInput.placeholder = t.paste_placeholder;
        pasteInputTarget.placeholder = t.paste_placeholder;

        // Restore button text if not calculating
        if (!calcFastBtn.disabled) {
            calcFastBtn.textContent = t.calc_fast_btn;
            calcOptimalBtn.textContent = t.calc_optimal_btn;
        }

        // Update list names directly
        const bugItems = document.querySelectorAll('.fruit-item');
        bugItems.forEach(item => {
            const bugName = item.dataset.bugName;
            const bugObj = BUGS.find(b => b.name === bugName); // bugName is always the unique Chinese key really
            if (bugObj) {
                const nameDisplay = currentLang === 'en' ? bugObj.nameEn : bugObj.name;
                item.querySelector('.fruit-name').textContent = nameDisplay;
            }
        });

        // Update summary text
        if (totalSummary.textContent === translations.zh.enter_prompt || totalSummary.textContent === translations.en.enter_prompt) {
            totalSummary.textContent = t.enter_prompt;
        } else {
            let total = 0;
            document.querySelectorAll('.fruit-count').forEach(c => total += parseInt(c.textContent));
            if (total === 0 && !errorMsg.classList.contains('hidden')) {
                errorMsg.textContent = t.error_msg;
            } else if (total === 0 && errorMsg.classList.contains('hidden')) {
                totalSummary.textContent = t.success_msg;
            } else {
                totalSummary.textContent = t.total_summary.replace('{n}', total);
            }
        }

        // Visitor Update
        if (typeof window.currentVisitorCount !== 'undefined') {
            const visitorCountEl = document.getElementById('visitor-count');
            if (visitorCountEl) {
                visitorCountEl.textContent = t.visitor_prefix + window.currentVisitorCount;
            }
        }
    }

    // Smart Paste Parser Logic
    function handlePaste(event, inputGroup) {
        const text = event.target.value;
        // Regex to match "R123", "G: 45", "B=200" etc.
        const rMatch = text.match(/R\s*[:=]?\s*(\d+)/i);
        const gMatch = text.match(/G\s*[:=]?\s*(\d+)/i);
        const bMatch = text.match(/B\s*[:=]?\s*(\d+)/i);

        if (rMatch) inputGroup.r.value = Math.min(450, parseInt(rMatch[1]));
        if (gMatch) inputGroup.g.value = Math.min(450, parseInt(gMatch[1]));
        if (bMatch) inputGroup.b.value = Math.min(450, parseInt(bMatch[1]));

        if (rMatch || gMatch || bMatch) {
            updatePreviews();
            saveState(); // Trigger save
            // Optional: Clear input or keep it? Keeping it lets user see what they pasted.
        }
    }

    // Attach listeners
    pasteInput.addEventListener('input', (e) => handlePaste(e, currentInputs));
    pasteInputTarget.addEventListener('input', (e) => handlePaste(e, targetInputs));

    // Calculate Actions
    calcFastBtn.addEventListener('click', () => performCalculation('fast'));
    calcOptimalBtn.addEventListener('click', () => performCalculation('optimal'));

    function performCalculation(mode) {
        const start = {
            r: parseInt(currentInputs.r.value) || 0,
            g: parseInt(currentInputs.g.value) || 0,
            b: parseInt(currentInputs.b.value) || 0
        };

        const target = {
            r: parseInt(targetInputs.r.value) || 0,
            g: parseInt(targetInputs.g.value) || 0,
            b: parseInt(targetInputs.b.value) || 0
        };

        // Basic validation
        if ([start.r, start.g, start.b, target.r, target.g, target.b].some(v => v < 0 || v > 450)) {
            alert('RGB values must be between 0 and 450');
            return;
        }

        // Show loading state
        const originalFastText = calcFastBtn.textContent;
        const originalOptimalText = calcOptimalBtn.textContent;

        calcFastBtn.textContent = translations[currentLang].calculating;
        calcOptimalBtn.textContent = '...';

        calcFastBtn.disabled = true;
        calcOptimalBtn.disabled = true;

        const allowErrorCheckbox = document.getElementById('allow-error');
        const allowedError = allowErrorCheckbox.checked ? 2 : 0;

        // Use setTimeout to allow UI to render the loading state
        setTimeout(async () => {
            try {
                const path = await solveColorPath(start, target, allowedError, mode);
                displayResults(path, allowedError);
            } catch (e) {
                // Ignore calculation errors (e.g. no path found)
                solutionList.innerHTML = `<li style="text-align:center; padding:15px; color:#ff6b6b;">${translations[currentLang].no_solution}</li>`;
            } finally {
                calcFastBtn.textContent = translations[currentLang].calc_fast_btn;
                calcOptimalBtn.textContent = translations[currentLang].calc_optimal_btn;
                calcFastBtn.disabled = false;
                calcOptimalBtn.disabled = false;
            }
        }, 50);
    }

    // Initialize the list on load
    function initBugList() {
        resultSection.classList.remove('hidden');
        solutionList.innerHTML = '';
        errorMsg.classList.add('hidden');

        BUGS.forEach(bug => {
            const el = document.createElement('div');
            el.className = 'fruit-item';
            el.dataset.bugName = bug.name; // Store key
            // Use placeholder or actual image if available
            // Check if we have run generate_image yet (handled by separate process, here we just link)
            const displayName = currentLang === 'en' ? bug.nameEn : bug.name;
            el.innerHTML = `
                <div class="fruit-info">
                   <img src="${bug.image}" alt="${bug.name}" class="fruit-img" onerror="this.style.display='none'">
                   <span class="fruit-name">${displayName}</span>
                   <span class="fruit-vals">(${bug.r}/${bug.g}/${bug.b})</span>
                </div>
                <div class="fruit-count">0</div>
            `;
            solutionList.appendChild(el);
        });
        totalSummary.textContent = translations[currentLang].enter_prompt;
    }

    initBugList();

    function displayResults(path, allowedError = 2) {
        resultSection.classList.remove('hidden');
        errorMsg.classList.add('hidden');

        // Reset all counts to 0
        const items = solutionList.querySelectorAll('.fruit-item');
        items.forEach(item => {
            item.querySelector('.fruit-count').textContent = '0';
            item.classList.remove('active');
        });

        if (path.length === 0) {
            // Check if already there or failed
            const curR = parseInt(currentInputs.r.value);
            const tarR = parseInt(targetInputs.r.value);
            const curG = parseInt(currentInputs.g.value);
            const tarG = parseInt(targetInputs.g.value);
            const curB = parseInt(currentInputs.b.value);
            const tarB = parseInt(targetInputs.b.value);

            // Use the passed allowedError + 1 (since < 3 means <= 2) or strict check
            const tolerance = allowedError === 0 ? 0.5 : 2.5;

            if (Math.abs(curR - tarR) < tolerance && Math.abs(curG - tarG) < tolerance && Math.abs(curB - tarB) < tolerance) {
                // Show result even if 0 feeds
                totalSummary.innerHTML = `
                    ${currentLang === 'zh' ? '最終結果:' : 'Final Result:'} <b style="color:var(--primary-color)">R:${curR} / G:${curG} / B:${curB}</b>
                `;
            } else {
                // If path is empty but not close, maybe solver failed or returned empty
                errorMsg.textContent = translations[currentLang].error_msg;
                errorMsg.classList.remove('hidden');
                totalSummary.textContent = '';
            }
            return;
        }

        // Count bugs
        const counts = {};
        path.forEach(bug => {
            counts[bug.name] = (counts[bug.name] || 0) + 1;
        });

        // Update DOM
        let total = 0;
        BUGS.forEach(bug => {
            const count = counts[bug.name] || 0;
            total += count;
            const item = solutionList.querySelector(`.fruit-item[data-bug-name="${bug.name}"]`);
            if (item) {
                item.querySelector('.fruit-count').textContent = count;
                if (count > 0) {
                    item.classList.add('active');
                }
            }
        });

        // Summary
        totalSummary.innerHTML = translations[currentLang].total_summary.replace('{n}', total);

        // Verification Line
        if (total > 0) {
            let simR = parseInt(currentInputs.r.value) || 0;
            let simG = parseInt(currentInputs.g.value) || 0;
            let simB = parseInt(currentInputs.b.value) || 0;

            path.forEach(bug => {
                simR = Math.max(0, Math.min(450, simR + bug.r));
                simG = Math.max(0, Math.min(450, simG + bug.g));
                simB = Math.max(0, Math.min(450, simB + bug.b));
            });

            const verifyText = document.createElement('div');
            verifyText.style.marginTop = "10px";
            verifyText.style.fontSize = "0.9rem";
            verifyText.style.color = "inherit";
            verifyText.style.opacity = "0.9";
            // verifyText.style.whiteSpace = "pre-line";

            verifyText.innerHTML = `
                ${currentLang === 'zh' ? '最終結果:' : 'Final Result:'} <b style="color:var(--primary-color)">R:${simR} / G:${simG} / B:${simB}</b>
            `;
            totalSummary.appendChild(verifyText);
        }

        // Scroll to results
        // resultSection.scrollIntoView({ behavior: 'smooth' });
    }
});
