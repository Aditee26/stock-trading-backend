const express = require('express');
const cors = require('cors');
const app = express();

// CORS setup
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Simple test route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Test server running' });
});

// Simple register route
app.post('/api/auth/register', (req, res) => {
  console.log('Test register:', req.body);
  res.json({
    success: true,
    message: 'Test registration successful',
    data: {
      user: { ...req.body, _id: '123', virtualBalance: 100000 },
      token: 'test-token-123'
    }
  });
});

// Simple login route
app.post('/api/auth/login', (req, res) => {
  console.log('Test login:', req.body);
  res.json({
    success: true,
    message: 'Test login successful',
    data: {
      user: { 
        name: 'Test User', 
        email: req.body.email,
        _id: '123', 
        virtualBalance: 100000 
      },
      token: 'test-token-123'
    }
  });
});

app.listen(5000, () => {
  console.log('✅ Test server running on port 5000');
});