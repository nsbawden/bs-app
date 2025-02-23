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
            const fullQuestion = `In ${context.book} ${context.chapter}:${context.verse} (${context.version}), ${question} - return as Markdown`;
            console.log(fullQuestion);
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
                                content: 'You are a Bible scholar. Provide detailed, accurate answers with multiple relevant verses and explanations, formatted in Markdown.'
                            },
                            { role: 'user', content: fullQuestion }
                        ],
                        max_tokens: openaiSettings.maxTokens,
                        temperature: openaiSettings.temperature
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

async function queryAI(question) {
    const context = {
        book: state.currentVerse.book,
        chapter: state.currentVerse.chapter,
        verse: state.currentVerse.verse,
        version: state.bibleVersion.toUpperCase()
    };
    aiOutput.textContent = 'Query copied to clipboard. Paste it to Grok/ChatGPT, then paste the answer in the popup.';
    const response = await currentAIModule.query(question, context);
    if (typeof marked !== 'undefined') {
        aiOutput.innerHTML = marked.parse(response);
        aiOutput.classList.add('expanded');
        aiToggle.textContent = 'Collapse';
    } else {
        console.error('Marked.js not loaded; displaying plain text');
        aiOutput.textContent = response;
    }
    const maxHistoryLength = parseInt(localStorage.getItem('maxHistoryLength')) || defaults.maxHistoryLength;
    state.aiHistory.push({ question, answer: response, context: `${context.book} ${context.chapter}:${context.verse} (${context.version})` });
    if (state.aiHistory.length > maxHistoryLength) {
        state.aiHistory = state.aiHistory.slice(-maxHistoryLength);
    }
    saveState();
}