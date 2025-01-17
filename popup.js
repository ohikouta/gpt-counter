document.addEventListener('DOMContentLoaded', () => {
    const countsTable = document.getElementById('countsTable');
    const resetButton = document.getElementById('resetButton');

    function loadCounts() {
        chrome.storage.local.get("promptCount", (data) => {
            const promptCount = data.promptCount || {};
            countsTable.innerHTML = ''; // テーブルをクリア

            for (const [model, info] of Object.entries(promptCount)) {
                const row = document.createElement('tr');

                const modelCell = document.createElement('td');
                modelCell.textContent = model;
                row.appendChild(modelCell);

                const countCell = document.createElement('td');
                countCell.textContent = info.count;
                row.appendChild(countCell);

                const resetCell = document.createElement('td');
                const lastReset = new Date(info.lastReset);
                resetCell.textContent = lastReset.toLocaleString();
                row.appendChild(resetCell);

                countsTable.appendChild(row);
            }

            if (Object.keys(promptCount).length === 0) {
                const row = document.createElement('tr');
                const cell = document.createElement('td');
                cell.colSpan = 3;
                cell.textContent = "No data available.";
                row.appendChild(cell);
                countsTable.appendChild(row);
            }
        });
    }

    resetButton.addEventListener('click', () => {
        if (confirm("カウントをリセットしますか？")) {
            chrome.storage.local.set({ promptCount: {} }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error resetting promptCount:", chrome.runtime.lastError);
                    return;
                }
                console.log("Prompt counts have been reset.");
                loadCounts();
                // バッジもリセット
                chrome.action.setBadgeText({ text: '0' }, () => {
                    if (chrome.runtime.lastError) {
                        console.error("Error resetting badge text:", chrome.runtime.lastError);
                        return;
                    }
                    console.log("Badge text reset to 0.");
                });
            });
        }
    });

    loadCounts();
});
