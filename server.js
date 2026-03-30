const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- LOCAL DATA SAVING ---
app.post('/api/save', (req, res) => {
    const { filename, data } = req.body;
    
    if (!['movies.json', 'series.json'].includes(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, filename);
    
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Successfully updated ${filename}`);
        res.json({ success: true });
    } catch (err) {
        console.error(`Error writing to ${filename}:`, err);
        res.status(500).json({ error: 'Failed to write to file' });
    }
});

app.listen(PORT, () => {
    console.log(`
🚀 mO movies Local Admin Server running!
---------------------------------------
URL: http://localhost:${PORT}
Admin Password: 323cbc

Use this server only while adding movies. 
After saving, commit your changes to GitHub to update the live site.
    `);
});