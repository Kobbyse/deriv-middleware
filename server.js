const express = require('express');
const WebSocket = require('ws');
const app = express();
app.use(express.json());

const APP_ID = '1089';

app.post('/trade', (req, res) => {
  const { token, instrument, direction, amount } = req.body;
  const contractType = direction === 'BUY' ? 'CALL' : 'PUT';

  const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
  let step = 'authorize';

  ws.on('open', () => {
    ws.send(JSON.stringify({ authorize: token }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if (msg.error) {
      ws.close();
      return res.status(400).json({ error: msg.error.message });
    }

    if (step === 'authorize' && msg.msg_type === 'authorize') {
      step = 'buy';
      ws.send(JSON.stringify({
        buy: 1,
        price: amount,
        parameters: {
          contract_type: contractType,
          symbol: instrument,
          duration: 5,
          duration_unit: 'm',
          basis: 'stake',
          amount: amount,
          currency: 'USD'
        }
      }));
    }

    if (step === 'buy' && msg.msg_type === 'buy') {
      ws.close();
      return res.json({
        status: 'executed',
        contractId: msg.buy.contract_id,
        buyPrice: msg.buy.buy_price,
        instrument,
        direction,
        amount
      });
    }
  });

  ws.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });

  setTimeout(() => {
    ws.close();
    if (!res.headersSent) res.status(504).json({ error: 'Timeout' });
  }, 15000);
});

app.get('/', (req, res) => res.send('Deriv Middleware Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
