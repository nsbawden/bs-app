// ai.js
const aiModules = {
    grokManual: {
        async query(question, context) {
            const fullQuery = `${context}: ${question}`;
            navigator.clipboard.writeText(fullQuery)
                .then(() => console.log('Query copied to clipboard:', fullQuery))
                .catch(err => console.error('Clipboard failed:', err));
            aiPopup.classList.remove('hidden');
            aiResponseInput.value = '';
            return new Promise(resolve => {
                aiResponseSubmit.onclick = () => {
                    const response = aiResponseInput.value.trim();
                    if (response) {
                        aiPopup.classList.add('hidden');
                        resolve(response);
                    }
                };
            });
        }
    },
    openAI: {
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        getCostRates(model) {
            const rates = {
                'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
                'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
                'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 }
            };
            return rates[model] || rates[defaults.openaiSettings.model];
        },
        getApiKey() {
            let apiKey = localStorage.getItem('openAI_apiKey');
            if (!apiKey) {
                apiKey = prompt('Please enter your OpenAI API Key:');
                if (apiKey) {
                    localStorage.setItem('openAI_apiKey', apiKey);
                } else {
                    throw new Error('No API key provided. Cannot proceed with OpenAI request.');
                }
            }
            return apiKey;
        },
        getTokenUsage() {
            const stored = localStorage.getItem('openAI_tokenUsage');
            return stored ? JSON.parse(stored) : {
                totalPromptTokens: 0,
                totalCompletionTokens: 0,
                totalCost: 0
            };
        },
        saveTokenUsage(usage) {
            localStorage.setItem('openAI_tokenUsage', JSON.stringify(usage));
        },
        async query(question, context) {
            console.log(question);
            try {
                const apiKey = this.getApiKey();
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: openaiSettings.model,
                        messages: [
                            {
                                role: 'system',
                                content: (context.system || "")
                            },
                            { role: 'user', content: `${question}` }
                        ],
                        max_tokens: openaiSettings.maxTokens,
                        temperature: (context.temperature || openaiSettings.temperature)
                    })
                });

                if (!response.ok) {
                    if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait and try again later.');
                    }
                    throw new Error('API request failed');
                }

                const data = await response.json();
                const content = data.choices[0].message.content;
                const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
                const usage = this.getTokenUsage();
                const rates = this.getCostRates(openaiSettings.model);
                usage.totalPromptTokens += prompt_tokens;
                usage.totalCompletionTokens += completion_tokens;
                usage.totalCost += (prompt_tokens * rates.input) + (completion_tokens * rates.output);
                this.saveTokenUsage(usage);
                console.log('Token Usage:', {
                    prompt_tokens,
                    completion_tokens,
                    total_tokens,
                    runningTotalCost: usage.totalCost.toFixed(6)
                });
                console.log(content);
                return content;
            } catch (error) {
                console.error('OpenAI Error:', error);
                return `Sorry, I couldn’t fetch a response: ${error.message}`;
            }
        }
    }
};

const currentAIModule = aiModules.openAI;

function insertBefore(marker, originalText, textToInsert) {
    const lmarker = marker.toLowerCase();
    const ltx = originalText.toLowerCase();
    const index = ltx.indexOf(lmarker);

    // If the marker isn't found, return the original text unchanged
    if (index === -1) {
        return originalText;
    }

    // Split the text into before and after the marker
    const before = originalText.substring(0, index);
    const after = originalText.substring(index);

    // Insert the new text with proper Markdown formatting (e.g., a new line)
    return `${before}${textToInsert}${after}`;
}

async function queryAI(question, context, timer, shouldCacheTranslation = false) {
    try {
        let response = await currentAIModule.query(question, context);

        if (context.verseText) {
            response = insertBefore('**Literal', response, context.verseText);
        }

        if (shouldCacheTranslation) {
            // Cache the translation result
            const cacheKey = `${context.book}-${context.chapter}-${context.verse}-${context.temperature}`;
            translationCache[cacheKey] = {
                response: response,
                timestamp: Date.now() // For FIFO pruning
            };
            saveTranslationCache(); // Persist the updated cache
        }

        clearInterval(timer); // Stop the timer when response is received
        displayResult(context.questionSuffix ? `${question}${context.questionSuffix}`: question, response);

        // Push to the front of the history stack
        const maxHistoryLength = parseInt(localStorage.getItem('maxHistoryLength')) || defaults.maxHistoryLength;
        aiHistory.unshift({
            question: question,
            answer: response,
            context: `${context.book} ${context.chapter}:${context.verse} (${context.version})`
        });
        if (aiHistory.length > maxHistoryLength) {
            aiHistory = aiHistory.slice(0, maxHistoryLength);
        }
        adjustTabCount(); // Show existing tabs and hide the rest

        saveState();
    } catch (error) {
        clearInterval(timer); // Stop the timer on error too
        aiOutput.textContent = `Error: ${error.message}`;
        console.error('AI query failed:', error);
    }
}

// load last history if available
if (aiHistory.length > 0) {
    displayResult(aiHistory[0].question, aiHistory[0].answer, false);
}