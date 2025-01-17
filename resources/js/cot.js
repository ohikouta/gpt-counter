console.log("cot.js loaded at top-level.");

// こちらも追加してみる
document.addEventListener('readystatechange', () => {
  console.log("Ready state changed:", document.readyState);
});

window.addEventListener('load', () => {
  console.log("window load event fired.");
});


// ページのロードが完了したら実行
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired.");

    // モデル選択ボタンを取得
    const modelButton = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
    console.log("Model button element:", modelButton);

    if (modelButton) {
        console.log("モデル選択ボタンが見つかりました。");

        // 初期モデル名を取得して送信
        const initialModelName = getModelName(modelButton);
        console.log(`初期モデル名: ${initialModelName}`);
        sendModelName(initialModelName);

        // モデル選択ボタン内の<span>要素を取得
        const modelSpan = modelButton.querySelector('span');
        console.log("Model span element:", modelSpan);

        if (modelSpan) {
            // MutationObserverを使用してモデル名の変更を監視
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'characterData' || mutation.type === 'childList') {
                        console.log("Mutation detected:", mutation);
                        const newModelName = getModelName(modelButton);
                        console.log(`新しいモデル名: ${newModelName}`);
                        sendModelName(newModelName);
                    }
                });
            });

            // モデル名のテキスト変更を監視
            observer.observe(modelSpan, { characterData: true, childList: true, subtree: true });
            console.log("MutationObserver for model name initialized.");
        }

        // ボタンの属性変更（aria-label）の監視
        const ariaObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'aria-label') {
                    console.log("aria-label mutation detected:", mutation);
                    const newModelName = getModelName(modelButton);
                    console.log(`新しいモデル名（aria-labelから）: ${newModelName}`);
                    sendModelName(newModelName);
                }
            });
        });

        ariaObserver.observe(modelButton, { attributes: true });
        console.log("MutationObserver for aria-label initialized.");
    } else {
        console.warn("モデル選択ボタンが見つかりませんでした。セレクタを確認してください。");
    }
});

// モデル名を取得する関数
function getModelName(modelButton) {
    // aria-labelからモデル名を抽出
    const ariaLabel = modelButton.getAttribute('aria-label');
    console.log(`aria-label: ${ariaLabel}`);
    const regex = /現在のモデルは\s*(\S+)\s*です/; // "現在のモデルは 4o です" から "4o" を抽出
    const match = ariaLabel.match(regex);
    if (match && match[1]) {
        console.log(`regex matched: ${match[1]}`);
        return match[1];
    }

    // fallback: ボタン内の<span>からモデル名を取得
    const modelSpan = modelButton.querySelector('span');
    if (modelSpan) {
        console.log(`span text content: ${modelSpan.textContent.trim()}`);
        return modelSpan.textContent.trim();
    }

    console.warn("モデル名の取得に失敗しました。");
    return 'unknown';
}

// モデル名をバックグラウンドスクリプトに送信する関数
function sendModelName(modelName) {
    chrome.runtime.sendMessage({ type: 'modelChange', modelName }, (response) => {
        if (chrome.runtime.lastError) {
            console.error("メッセージ送信エラー:", chrome.runtime.lastError);
        } else {
            console.log("モデル変更メッセージが正常に送信されました。");
        }
    });
    console.log(`送信されたモデル名: ${modelName}`);
}
