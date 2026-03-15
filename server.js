import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const client = new Anthropic();

app.post('/api/chat', async (req, res) => {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array required' });
    }

    // Filter to only user/assistant messages (exclude any leading assistant messages)
    const filtered = messages.filter(m => m.role === 'user' || m.role === 'assistant');

    // Anthropic requires messages to start with 'user'
    const startIndex = filtered.findIndex(m => m.role === 'user');
    const apiMessages = startIndex >= 0 ? filtered.slice(startIndex) : filtered;

    if (apiMessages.length === 0) {
        return res.status(400).json({ error: 'No user messages found' });
    }

    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: system || '',
            messages: apiMessages,
        });

        const content = response.content[0]?.text ?? '';
        res.json({ content });
    } catch (err) {
        console.error('Anthropic API error:', err.message);
        if (err.status === 401) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        res.status(500).json({ error: 'AI service error' });
    }
});

// Serve index.html for unknown routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Edge server running at http://localhost:${PORT}`);
    console.log('Make sure ANTHROPIC_API_KEY is set in your environment.');
});
