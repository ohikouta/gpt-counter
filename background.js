// background.js

// 拡張機能がインストールされたときに初期化
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed. Initializing storage...");
    chrome.storage.local.set({
        promptCount: {},
        // 旧: tabModels
        // 新: conversationModels
        conversationModels: {}
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error initializing storage:", chrome.runtime.lastError);
            return;
        }
        console.log("Storage initialized.");
        updateBadge();
    });
});

console.log("Background script loaded");

/**
 * 既存の onMessage 部分 (DOM 監視などで modelChange を受け取る場合)
 * 必要なければ残さなくてもOK。
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'modelChange') {
        // 従来: tabId ベースで tabModels[tabId] = modelName
        // 今後: もし conversation_id が取れないなら補助的に使う、等
        console.log("Received modelChange via onMessage, but using conversation-based logic now.");
    }
});

// タブが閉じられたときに conversationModels を掃除…するかどうかは任意。
// conversation_id 自体がタブ閉鎖と連動しないため、ここでは削除しない例とする。
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    // 今はやらない or 必要に応じて実装
    // 例えば conversationModels の中から「このタブに紐づくIDがあれば消す」など
});

// リクエストをインターセプトしてカウントを更新
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);

        // POSTでなければ無視
        if (details.method !== "POST") {
            console.log("[CounterExtension] Ignored non-POST request:", details.url);
            return;
        }

        // 会話APIかどうか判定
        if (!url.pathname.includes('/backend-api/conversation')) {
            console.log("[CounterExtension] Not a conversation endpoint, skipping:", details.url);
            return;
        }

        console.log(`Intercepted conversation request: ${details.url}`);

        // リクエスト本文から conversation_id と model を解析
        let conversationId = null;
        let foundModel = null;
        let isUserPrompt = false;

        if (details.requestBody?.raw?.length > 0) {
            try {
                const decoder = new TextDecoder("utf-8");
                const bodyString = decoder.decode(details.requestBody.raw[0].bytes);
                console.log("Raw body string:", bodyString);

                if (bodyString) {
                    const parsed = JSON.parse(bodyString);
                    // action === "next" でユーザー送信とみなす
                    if (parsed.action === "next") {
                        isUserPrompt = true;
                    } else {
                        console.log("[CounterExtension] action != next, skipping count.");
                        return;
                    }
                    // conversation_id
                    if (parsed.conversation_id) {
                        conversationId = parsed.conversation_id;
                    }
                    // model
                    if (parsed.model) {
                        foundModel = parsed.model;
                        console.log(`Found model in JSON body: ${foundModel}`);
                    }
                }
            } catch (err) {
                console.warn("Error parsing requestBody:", err);
            }
        }

        if (!isUserPrompt) {
            console.log("[CounterExtension] Not a user prompt, skipping.");
            return;
        }

        // conversation_id が取れない場合のフォールバック
        if (!conversationId) {
            conversationId = "unknown_conv_" + Date.now(); 
            console.log("No conversation_id found. Using fallback:", conversationId);
        }

        // ストレージを取得
        chrome.storage.local.get(["conversationModels", "promptCount"], (data) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting storage data:", chrome.runtime.lastError);
                return;
            }

            const convModels = data.conversationModels || {};
            const promptCount = data.promptCount || {};

            // もし JSON に model が見つかったら conversationModels に保存
            if (foundModel) {
                console.log(`Updating conversation ${conversationId} -> model ${foundModel}`);
                convModels[conversationId] = foundModel;
                chrome.storage.local.set({ conversationModels: convModels });
            }

            // conversation_id からモデルを取得
            // foundModel があればそちらを優先、なければ conversationModels[conversationId] を使う
            const modelName = foundModel || convModels[conversationId] || 'unknown';
            console.log(`Model for conversation ${conversationId}: ${modelName}`);

            if (modelName === 'unknown') {
                console.warn(`Model name for conversation ${conversationId} is unknown. Skipping count.`);
                return;
            }

            // カウントロジック (モデル単位で集計する例)
            const modelData = promptCount[modelName] || { count: 0, lastReset: null };
            const now = new Date();

            // リセット判定 (既存ロジック)
            let shouldReset = false;
            if (modelName === 'o1') {
                // 1週間以上経過 → リセット
                if (!modelData.lastReset || (now - new Date(modelData.lastReset)) > 7 * 24 * 60 * 60 * 1000) {
                    shouldReset = true;
                }
            } else if (modelName === 'o1-mini') {
                // 1日以上経過 → リセット
                if (!modelData.lastReset || (now - new Date(modelData.lastReset)) > 24 * 60 * 60 * 1000) {
                    shouldReset = true;
                }
            }

            if (shouldReset) {
                console.log(`Resetting count for model ${modelName}. Previous count: ${modelData.count}`);
                modelData.count = 0;
                modelData.lastReset = now.toISOString();
            }

            // カウントを増加
            modelData.count += 1;
            console.log(`Incremented count for model ${modelName}: ${modelData.count}`);

            // 保存
            promptCount[modelName] = modelData;
            chrome.storage.local.set({ promptCount }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Error setting promptCount:", chrome.runtime.lastError);
                    return;
                }
                console.log(`Prompt count for ${modelName} updated to ${modelData.count}`);
                updateBadge();
            });
        });
    },
    { urls: ["*://chatgpt.com/*"] },
    ["requestBody"]
);

// バッジを更新する関数 (同じ)
function updateBadge() {
    chrome.storage.local.get(["promptCount"], (data) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting promptCount for badge:", chrome.runtime.lastError);
            return;
        }
        const promptCount = data.promptCount || {};
        const totalCount = Object.values(promptCount).reduce((sum, model) => sum + model.count, 0);
        console.log(`Total prompt count: ${totalCount}`);

        chrome.browserAction.setBadgeText({ text: totalCount.toString() }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error setting badge text:", chrome.runtime.lastError);
                return;
            }
            console.log(`Badge text set to: ${totalCount}`);
        });
        chrome.browserAction.setBadgeBackgroundColor({ color: '#4688F1' }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error setting badge background color:", chrome.runtime.lastError);
                return;
            }
            console.log("Badge background color set to #4688F1");
        });
    });
}

// ストレージが変更されたときにバッジを更新
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.promptCount) {
        console.log("promptCount changed, updating badge.");
        updateBadge();
    }
});
