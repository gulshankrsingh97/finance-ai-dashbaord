// Finance Dashboard Application
class FinanceDashboard {
    constructor() {
        this.charts = {};
        this.data = {};
        this.refreshInterval = null;
        this.isRefreshing = false;
        
        // Configuration from provided data
        this.symbols = {
            nifty: "^NSEI",
            bankNifty: "^NSEBANK", 
            midcap: "^NSEMIDCAP",
            bitcoin: "BTC-USD",
            ethereum: "ETH-USD",
            solana: "SOL-USD",
            nvidia: "NVDA",
            oracle: "ORCL",
            tesla: "TSLA"
        };
        
        this.chartColors = {
            nifty: "#60a5fa",
            bankNifty: "#22c55e",
            midcap: "#a78bfa",
            bitcoin: "#f59e0b",
            ethereum: "#06b6d4",
            solana: "#fb7185",
            nvidia: "#84cc16",
            oracle: "#38bdf8",
            tesla: "#7c3aed"
        };
        
        this.apiConfig = {
            baseUrl: "https://query1.finance.yahoo.com/v8/finance/chart",
            range: "1d",
            interval: "5m",
            refreshInterval: 60000
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeCharts();
        this.loadInitialData();
        this.startAutoRefresh();
        this.initializeAssistant();
        this.updateConnectionStatus('connecting');
    }
    
    setupEventListeners() {
        // Assistant event listeners
        document.getElementById('sendMessage').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        document.getElementById('testConnection').addEventListener('click', () => this.testAIConnection());
        document.getElementById('clearHistory').addEventListener('click', () => this.clearChatHistory());
        
        // Intent button listeners
        document.querySelectorAll('.intent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.intent-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const intent = e.target.dataset.intent;
                this.updateInputPlaceholder(intent);
            });
        });
    }
    
    updateInputPlaceholder(intent) {
        const input = document.getElementById('chatInput');
        const placeholders = {
            chat: "Ask about market trends, analysis, or general questions...",
            search: "Search for stocks, news, or financial information...",
            navigate: "Navigate to a website or perform web actions..."
        };
        input.placeholder = placeholders[intent] || "Type your message...";
    }
    
    initializeCharts() {
        const chartConfigs = Object.keys(this.symbols).map(key => ({
            id: key,
            canvasId: key === 'bankNifty' ? 'bankNiftyChart' : `${key}Chart`,
            color: this.chartColors[key]
        }));
        
        chartConfigs.forEach(config => {
            const canvas = document.getElementById(config.canvasId);
            if (canvas) {
                this.charts[config.id] = this.createChart(canvas, config.color);
            }
        });
    }
    
    createChart(canvas, color) {
        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm'
                            }
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        },
                        ticks: {
                            color: '#9ca3af'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }
    
    async loadInitialData() {
        this.updateConnectionStatus('loading');
        const promises = Object.keys(this.symbols).map(key => 
            this.fetchMarketData(key, this.symbols[key])
        );
        
        try {
            await Promise.all(promises);
            this.updateConnectionStatus('connected');
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.updateConnectionStatus('error');
            // Load fallback data for all symbols when API fails
            Object.keys(this.symbols).forEach(key => this.showFallbackData(key));
        }
    }
    
    async fetchMarketData(key, symbol) {
        const statusElement = document.getElementById(`${key}-status`);
        
        try {
            statusElement.textContent = 'Loading...';
            
            // Use a CORS proxy for Yahoo Finance API
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const targetUrl = `${this.apiConfig.baseUrl}/${symbol}?range=${this.apiConfig.range}&interval=${this.apiConfig.interval}`;
            const url = proxyUrl + encodeURIComponent(targetUrl);
            
            const response = await fetch(url);
            const proxyData = await response.json();
            const data = JSON.parse(proxyData.contents);
            
            if (data.chart && data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const timestamps = result.timestamp;
                const prices = result.indicators.quote[0].close;
                const meta = result.meta;
                
                // Filter out null values
                const chartData = timestamps.map((timestamp, index) => ({
                    x: new Date(timestamp * 1000),
                    y: prices[index]
                })).filter(point => point.y !== null);
                
                // Update chart
                if (this.charts[key]) {
                    this.charts[key].data.labels = chartData.map(point => point.x);
                    this.charts[key].data.datasets[0].data = chartData;
                    this.charts[key].update('none');
                }
                
                // Update price display
                this.updatePriceDisplay(key, meta);
                statusElement.textContent = `Last: ${new Date().toLocaleTimeString()}`;
                
                this.data[key] = { chartData, meta };
            } else {
                throw new Error('Invalid data format');
            }
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
            statusElement.textContent = 'Using demo data';
            this.showFallbackData(key);
        }
    }
    
    updatePriceDisplay(key, meta) {
        const priceElement = document.getElementById(`${key}-price`);
        const changeElement = document.getElementById(`${key}-change`);
        
        if (priceElement && changeElement && meta) {
            const price = meta.regularMarketPrice || 0;
            const previousClose = meta.previousClose || price;
            const change = price - previousClose;
            const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
            
            // Format price based on symbol type
            let formattedPrice;
            if (key.includes('bitcoin') || key.includes('ethereum') || key.includes('solana')) {
                formattedPrice = `$${price.toFixed(2)}`;
            } else if (key.includes('nifty') || key.includes('midcap')) {
                formattedPrice = price.toFixed(2);
            } else {
                formattedPrice = `$${price.toFixed(2)}`;
            }
            
            priceElement.textContent = formattedPrice;
            
            const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
            changeElement.textContent = changeText;
            changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    showFallbackData(key) {
        // Generate sample data for demo purposes when API fails
        const now = new Date();
        const fallbackData = [];
        
        for (let i = 78; i >= 0; i--) { // 78 * 5min = 390min = 6.5 hours (trading day)
            const time = new Date(now.getTime() - (i * 5 * 60 * 1000));
            const basePrice = this.getFallbackBasePrice(key);
            const randomVariation = (Math.random() - 0.5) * basePrice * 0.02;
            fallbackData.push({
                x: time,
                y: basePrice + randomVariation
            });
        }
        
        if (this.charts[key]) {
            this.charts[key].data.labels = fallbackData.map(point => point.x);
            this.charts[key].data.datasets[0].data = fallbackData;
            this.charts[key].update('none');
        }
        
        // Update price display with fallback data
        const lastPrice = fallbackData[fallbackData.length - 1].y;
        const firstPrice = fallbackData[0].y;
        const change = lastPrice - firstPrice;
        const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
        
        const priceElement = document.getElementById(`${key}-price`);
        const changeElement = document.getElementById(`${key}-change`);
        
        if (priceElement && changeElement) {
            priceElement.textContent = this.formatFallbackPrice(key, lastPrice);
            const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
            changeElement.textContent = changeText;
            changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
        }
    }
    
    getFallbackBasePrice(key) {
        const basePrices = {
            nifty: 24000,
            bankNifty: 48000,
            midcap: 12000,
            bitcoin: 45000,
            ethereum: 2800,
            solana: 180,
            nvidia: 450,
            oracle: 120,
            tesla: 250
        };
        return basePrices[key] || 100;
    }
    
    formatFallbackPrice(key, price) {
        if (key.includes('bitcoin') || key.includes('ethereum') || key.includes('solana') || 
            key === 'nvidia' || key === 'oracle' || key === 'tesla') {
            return `$${price.toFixed(2)}`;
        }
        return price.toFixed(2);
    }
    
    startAutoRefresh() {
        // Start refresh timer
        this.refreshInterval = setInterval(() => {
            if (!this.isRefreshing) {
                this.refreshData();
            }
        }, this.apiConfig.refreshInterval);
        
        // Log that auto-refresh is active
        console.log('Auto-refresh started - updates every 60 seconds');
    }
    
    async refreshData() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        console.log('Refreshing market data...');
        
        try {
            const promises = Object.keys(this.symbols).map(key => 
                this.fetchMarketData(key, this.symbols[key])
            );
            await Promise.all(promises);
            this.updateLastRefreshTime();
        } catch (error) {
            console.error('Error refreshing data:', error);
        } finally {
            this.isRefreshing = false;
        }
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const statusDot = statusElement.querySelector('.status-dot');
        
        statusDot.className = 'status-dot';
        
        switch (status) {
            case 'connected':
                statusElement.innerHTML = '<span class="status-dot connected"></span>Connected';
                document.getElementById('marketStatus').textContent = 'Active';
                break;
            case 'connecting':
                statusElement.innerHTML = '<span class="status-dot"></span>Connecting...';
                document.getElementById('marketStatus').textContent = 'Loading...';
                break;
            case 'loading':
                statusElement.innerHTML = '<span class="status-dot"></span>Loading Data...';
                break;
            case 'error':
                statusElement.innerHTML = '<span class="status-dot error"></span>Demo Mode';
                document.getElementById('marketStatus').textContent = 'Demo';
                break;
        }
    }
    
    updateLastRefreshTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('lastUpdate').textContent = timeString;
    }
    
    // AI Assistant functionality
    initializeAssistant() {
        this.messageHistory = [];
        this.currentIntent = 'chat';
        this.aiBridgeUrl = 'http://localhost:3001';
        this.aiAvailable = false;
        
        // Set initial status
        document.getElementById('aiStatus').textContent = 'Initializing...';
        
        // Check for Chrome extension
        this.checkChromeExtension();
        // Probe local AI bridge availability
        this.probeLocalAI();
    }
    
    async checkChromeExtension() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                // Chrome extension environment detected
                document.getElementById('aiStatus').textContent = 'Extension Ready';
            } else {
                // Fallback mode
                document.getElementById('aiStatus').textContent = 'Local Mode';
            }
        } catch (error) {
            document.getElementById('aiStatus').textContent = 'Ready';
        }
    }
    
    async probeLocalAI() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const resp = await fetch(`${this.aiBridgeUrl}/health`, { signal: controller.signal });
            clearTimeout(timeout);
            if (resp.ok) {
                this.aiAvailable = true;
                document.getElementById('aiStatus').textContent = 'Connected';
                return true;
            }
        } catch (e) {
            // ignore
        }
        this.aiAvailable = false;
        const current = document.getElementById('aiStatus');
        if (current && current.textContent === 'Initializing...') {
            current.textContent = 'Local Mode';
        }
        return false;
    }
    
    async chatWithLocalAI() {
        // Build OpenAI-style messages from history
        const history = this.messageHistory.map(m => ({
            role: m.sender === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : String(m.content)
        }));
        const resp = await fetch(`${this.aiBridgeUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: history,
                temperature: 0.7,
                max_tokens: -1,
                stream: false
            })
        });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`AI bridge error ${resp.status}: ${text}`);
        }
        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '';
    }
    
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Get current intent
        const activeIntent = document.querySelector('.intent-btn.active');
        const intent = activeIntent ? activeIntent.dataset.intent : 'chat';
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        input.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Process message based on intent
        setTimeout(async () => {
            this.hideTypingIndicator();
            await this.processMessage(message, intent);
        }, 1000);
    }
    
    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant-message typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-content">
                <span class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </span>
                AI is thinking...
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    addMessageToChat(sender, content) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message new`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (typeof content === 'string') {
            contentDiv.innerHTML = this.formatMessage(content);
        } else {
            contentDiv.appendChild(content);
        }
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Store in history
        this.messageHistory.push({ sender, content: content.toString(), timestamp: new Date() });
    }
    
    formatMessage(content) {
        // Basic formatting for URLs, mentions, etc.
        return content
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
    }
    
    async processMessage(message, intent) {
        try {
            let response;
            
            switch (intent) {
                case 'search':
                    response = await this.handleSearchIntent(message);
                    break;
                case 'navigate':
                    response = await this.handleNavigateIntent(message);
                    break;
                default:
                    response = await this.handleChatIntent(message);
                    break;
            }
            
            this.addMessageToChat('assistant', response);
        } catch (error) {
            console.error('Error processing message:', error);
            this.addMessageToChat('assistant', 'I encountered an error processing your request. Please try again.');
        }
    }
    
    async handleChatIntent(message) {
        // Prefer local AI if available
        if (this.aiAvailable) {
            try {
                // Ensure latest user message is in history before calling
                const last = this.messageHistory[this.messageHistory.length - 1];
                if (!last || last.sender !== 'user') {
                    this.messageHistory.push({ sender: 'user', content: message, timestamp: new Date() });
                }
                const aiReply = await this.chatWithLocalAI();
                return aiReply || this.generateChatResponse(message);
            } catch (e) {
                // Fall through to heuristic responses
            }
        }
        // Heuristic responses
        if (this.isMarketQuery(message)) {
            return this.generateMarketResponse(message);
        }
        return this.generateChatResponse(message);
    }
    
    async handleSearchIntent(message) {
        // Create search URL
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(message + ' finance stocks')}`;
        
        // Try to open in Chrome extension context
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            try {
                await chrome.tabs.create({ url: searchUrl });
                return `I've opened a search for "${message}" in a new tab.`;
            } catch (error) {
                return `I would search for "${message}" but I need extension permissions. You can search here: <a href="${searchUrl}" target="_blank">Open Search</a>`;
            }
        }
        
        return `I've prepared a search for "${message}". <a href="${searchUrl}" target="_blank">Click here to open the search</a>`;
    }
    
    async handleNavigateIntent(message) {
        // Extract URL from message
        const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
        
        if (urlMatch) {
            const url = urlMatch[0];
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                try {
                    await chrome.tabs.create({ url });
                    return `I've opened ${url} in a new tab.`;
                } catch (error) {
                    return `I would navigate to ${url} but I need extension permissions. <a href="${url}" target="_blank">Click here to open</a>`;
                }
            }
            return `<a href="${url}" target="_blank">Click here to navigate to ${url}</a>`;
        }
        
        // Handle navigation commands
        if (message.toLowerCase().includes('bloomberg')) {
            const url = 'https://www.bloomberg.com/markets';
            return `<a href="${url}" target="_blank">Click here to open Bloomberg Markets</a>`;
        }
        
        if (message.toLowerCase().includes('yahoo finance')) {
            const url = 'https://finance.yahoo.com/';
            return `<a href="${url}" target="_blank">Click here to open Yahoo Finance</a>`;
        }
        
        return 'Please provide a specific URL or website to navigate to. I can help you navigate to Bloomberg, Yahoo Finance, or any specific URL.';
    }
    
    isMarketQuery(message) {
        const marketKeywords = ['price', 'stock', 'nifty', 'bitcoin', 'ethereum', 'tesla', 'nvidia', 'oracle', 'market', 'trading', 'analysis', 'trend', 'crypto', 'solana'];
        return marketKeywords.some(keyword => message.toLowerCase().includes(keyword));
    }
    
    generateMarketResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Check for specific symbols in the message
        for (const [key, symbol] of Object.entries(this.symbols)) {
            if (lowerMessage.includes(key) || lowerMessage.includes(symbol.toLowerCase().replace('-usd', '').replace('^', ''))) {
                const data = this.data[key];
                const priceElement = document.getElementById(`${key}-price`);
                const currentPrice = priceElement ? priceElement.textContent : 'N/A';
                
                return `📊 **${key.toUpperCase()}** (${symbol}): Currently trading at **${currentPrice}**. The chart shows intraday movement with typical market volatility. This data refreshes automatically every minute to keep you updated with the latest market movements.`;
            }
        }
        
        // General market responses based on keywords
        if (lowerMessage.includes('trend') || lowerMessage.includes('analysis')) {
            return '📈 Based on the current dashboard data, I can see movement across all tracked markets:\n\n• **India Markets**: Nifty 50, Bank Nifty, and Midcap showing typical intraday patterns\n• **Crypto**: Bitcoin, Ethereum, and Solana with characteristic volatility\n• **US Stocks**: NVIDIA, Oracle, and Tesla reflecting tech sector movement\n\nWhat specific analysis would you like me to focus on?';
        }
        
        if (lowerMessage.includes('crypto')) {
            return '₿ **Cryptocurrency Update**: I\'m tracking Bitcoin, Ethereum, and Solana on your dashboard. All three are showing their characteristic volatility patterns. Crypto markets operate 24/7, so you\'ll see continuous price movements. Would you like me to focus on any specific cryptocurrency?';
        }
        
        if (lowerMessage.includes('nifty') || lowerMessage.includes('india')) {
            return '🇮🇳 **Indian Markets**: Your dashboard tracks three key Indian indices - Nifty 50 (broader market), Bank Nifty (banking sector), and Midcap Nifty (mid-cap companies). These provide a comprehensive view of the Indian equity market performance.';
        }
        
        if (lowerMessage.includes('us') || lowerMessage.includes('nasdaq') || lowerMessage.includes('america')) {
            return '🇺🇸 **US Market Focus**: I\'m monitoring NVIDIA (semiconductor/AI), Oracle (enterprise software), and Tesla (electric vehicles/tech). These represent key sectors in the US market and are updated with live data throughout trading hours.';
        }
        
        return '📊 I can help analyze the current market data displayed on your dashboard. I\'m tracking 9 different financial instruments across India, crypto, and US markets. What specific market or stock would you like me to analyze?';
    }
    
    generateChatResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            return '👋 Hello! I\'m your AI financial assistant. I can help you analyze the market data on your dashboard, search for financial information, or navigate to financial websites. What would you like to explore?';
        }
        
        if (lowerMessage.includes('help')) {
            return '🤖 **I can help you with:**\n\n• **Market Analysis**: Analyze trends and data from your dashboard\n• **Search**: Find financial news, stock information, or market data\n• **Navigation**: Open financial websites like Bloomberg, Yahoo Finance, etc.\n• **Chat**: Answer questions about markets and trading\n\nJust ask me anything or use the intent buttons (Chat, Search, Navigate) to specify what you need!';
        }
        
        if (lowerMessage.includes('current') && lowerMessage.includes('market')) {
            return '📊 The current market shows activity across all tracked instruments. Your dashboard is displaying real-time data (or demo data if APIs are unavailable) for 9 different financial instruments. The data refreshes every 60 seconds automatically. Which specific market would you like me to analyze?';
        }
        
        const responses = [
            '💭 That\'s an interesting question! Based on the financial data I have access to, I can provide insights on the markets displayed on your dashboard. What specific aspect would you like me to explore?',
            '🔍 I understand what you\'re asking about. I can help analyze market trends, explain financial concepts, or guide you through the data on your dashboard. What would you like to focus on?',
            '📈 Great question! I\'m here to help with market analysis, data interpretation, and financial insights. Is there a particular stock, index, or market trend you\'d like me to examine?',
            '💡 I can assist with that! My specialty is financial analysis and market insights based on the live data shown on your dashboard. What specific information are you looking for?'
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    async testAIConnection() {
        const button = document.getElementById('testConnection');
        const originalText = button.textContent;
        
        button.textContent = 'Testing...';
        button.disabled = true;
        
        try {
            const ok = await this.probeLocalAI();
            if (ok) {
                this.addMessageToChat('assistant', '✅ Local AI bridge is reachable at ' + this.aiBridgeUrl + '. I can answer using the local model.');
            } else {
                this.addMessageToChat('assistant', 'ℹ️ Local AI bridge not reachable. I will use built-in heuristic responses. You can start the bridge with: node ai-bridge.js');
            }
        } catch (error) {
            this.addMessageToChat('assistant', '❌ Connection test encountered an issue, but I\'m still operating in local mode and can help with market analysis and basic queries.');
            document.getElementById('aiStatus').textContent = 'Local Mode';
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }
    
    clearChatHistory() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="message assistant-message">
                <div class="message-content">
                    <p>👋 Hello! I'm your AI financial assistant. I can help you:</p>
                    <ul>
                        <li>Analyze market data and trends</li>
                        <li>Search for financial information</li>
                        <li>Navigate websites and perform actions</li>
                        <li>Answer questions about the markets</li>
                    </ul>
                    <p>How can I assist you today?</p>
                </div>
            </div>
        `;
        this.messageHistory = [];
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.financeDashboard = new FinanceDashboard();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.financeDashboard) {
        window.financeDashboard.destroy();
    }
});