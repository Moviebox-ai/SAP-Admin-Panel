import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Razorpay from 'razorpay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── In-Memory / Environment Razorpay Config ───────────────────
let razorpayConfig = {
  keyId: process.env.RAZORPAY_KEY_ID || '',
  keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  accountNumber: process.env.RAZORPAY_ACCOUNT_NUMBER || '',
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
};

function getRazorpayInstance() {
  const keyId = razorpayConfig.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = razorpayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function getAuthHeader() {
  const keyId = razorpayConfig.keyId || process.env.RAZORPAY_KEY_ID;
  const keySecret = razorpayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

// ── 1. GET /api/razorpay/config ───────────────────────────────
app.get('/api/razorpay/config', (req, res) => {
  const keyId = razorpayConfig.keyId || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = razorpayConfig.keySecret || process.env.RAZORPAY_KEY_SECRET || '';
  const accountNumber = razorpayConfig.accountNumber || process.env.RAZORPAY_ACCOUNT_NUMBER || '';

  const isConfigured = Boolean(keyId && keySecret);
  const isTest = keyId.startsWith('rzp_test_');
  const isLive = keyId.startsWith('rzp_live_');
  const maskedKeyId = keyId ? `${keyId.slice(0, 8)}••••••••${keyId.slice(-4)}` : '';
  const maskedAccount = accountNumber ? `••••••••${accountNumber.slice(-4)}` : '';

  res.json({
    success: true,
    configured: isConfigured,
    mode: isLive ? 'LIVE' : isTest ? 'TEST' : isConfigured ? 'CUSTOM' : 'NOT_CONFIGURED',
    keyIdMasked: maskedKeyId,
    accountNumberMasked: maskedAccount,
    hasAccountNumber: Boolean(accountNumber),
  });
});

// ── 2. POST /api/razorpay/save-config ──────────────────────────
app.post('/api/razorpay/save-config', (req, res) => {
  const { keyId, keySecret, accountNumber, webhookSecret } = req.body;

  if (!keyId || !keySecret) {
    return res.status(400).json({
      success: false,
      message: 'Razorpay Key ID and Key Secret are required.',
    });
  }

  razorpayConfig.keyId = keyId.trim();
  razorpayConfig.keySecret = keySecret.trim();
  if (accountNumber !== undefined) razorpayConfig.accountNumber = String(accountNumber).trim();
  if (webhookSecret !== undefined) razorpayConfig.webhookSecret = String(webhookSecret).trim();

  res.json({
    success: true,
    message: 'Razorpay configuration saved successfully in server session.',
    mode: razorpayConfig.keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST',
  });
});

// ── 3. POST /api/razorpay/test-connection ──────────────────────
app.post('/api/razorpay/test-connection', async (req, res) => {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay credentials not configured. Please enter Key ID and Secret first.',
      });
    }

    // Ping Razorpay contacts / payments API to verify credentials
    const response = await fetch('https://api.razorpay.com/v1/contacts?count=1', {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      const keyId = razorpayConfig.keyId || process.env.RAZORPAY_KEY_ID || '';
      return res.json({
        success: true,
        message: 'Connection successful! Razorpay API credentials are valid.',
        mode: keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST',
      });
    } else {
      return res.status(response.status).json({
        success: false,
        message: data.error?.description || 'Razorpay authentication failed. Please check Key ID & Secret.',
        error: data.error,
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Failed to connect to Razorpay: ${err.message}`,
    });
  }
});

// ── 4. POST /api/razorpay/create-payout ────────────────────────
// Handles Instant Direct Payout via UPI VPA or Bank Account
app.post('/api/razorpay/create-payout', async (req, res) => {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay is not configured. Please provide Razorpay Key ID and Secret.',
      });
    }

    const {
      requestId,
      userId,
      name,
      email,
      phone,
      amountInr,
      mode = 'UPI', // 'UPI' | 'IMPS' | 'NEFT'
      upiId,
      accountNumber,
      ifsc,
      narration = 'Self Attendance Pro Payout',
    } = req.body;

    const amount = Number(amountInr);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount.' });
    }

    // Convert amount to paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    // 1. Create or Find Razorpay Contact
    const contactPayload = {
      name: name || 'Attendance Pro User',
      email: email || `${userId || 'user'}@attendancepro.local`,
      contact: phone ? String(phone).replace(/\D/g, '').slice(-10) : '9999999999',
      type: 'employee',
      reference_id: userId ? `user_${String(userId).slice(0, 30)}` : undefined,
    };

    const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });

    const contactData = await contactRes.json();
    if (!contactRes.ok && contactData.error?.code !== 'BAD_REQUEST_ERROR') {
      return res.status(contactRes.status).json({
        success: false,
        message: `Contact creation failed: ${contactData.error?.description || contactRes.statusText}`,
        error: contactData.error,
      });
    }

    const contactId = contactData.id || 'cont_dummy_fallback';

    // 2. Create Fund Account (UPI or Bank Account)
    let fundAccountPayload;
    if (mode === 'UPI' && upiId) {
      fundAccountPayload = {
        contact_id: contactId,
        account_type: 'vpa',
        vpa: {
          address: upiId.trim(),
        },
      };
    } else if (accountNumber && ifsc) {
      fundAccountPayload = {
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: name || 'User',
          ifsc: ifsc.trim().toUpperCase(),
          account_number: String(accountNumber).trim(),
        },
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either UPI ID or Bank Account Number with IFSC is required for direct payout.',
      });
    }

    const faRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fundAccountPayload),
    });

    const faData = await faRes.json();
    if (!faRes.ok) {
      return res.status(faRes.status).json({
        success: false,
        message: `Fund account creation failed: ${faData.error?.description || faRes.statusText}`,
        error: faData.error,
      });
    }

    const fundAccountId = faData.id;
    const razorpayXAccount = razorpayConfig.accountNumber || process.env.RAZORPAY_ACCOUNT_NUMBER;

    // 3. Initiate Payout
    const payoutPayload = {
      account_number: razorpayXAccount || '7878780080316316', // Fallback virtual account or user-configured
      fund_account_id: fundAccountId,
      amount: amountInPaise,
      currency: 'INR',
      mode: mode === 'UPI' ? 'UPI' : (mode === 'IMPS' ? 'IMPS' : 'NEFT'),
      purpose: 'payout',
      queue_if_low_balance: true,
      reference_id: requestId ? `req_${String(requestId).slice(0, 30)}` : `payout_${Date.now()}`,
      narration: String(narration).slice(0, 30),
    };

    const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutPayload),
    });

    const payoutData = await payoutRes.json();

    if (payoutRes.ok) {
      return res.json({
        success: true,
        payoutId: payoutData.id,
        status: payoutData.status || 'processed',
        utr: payoutData.utr || `UTR-${Date.now()}`,
        mode: payoutData.mode || mode,
        amount: amount,
        referenceId: payoutPayload.reference_id,
        message: `Payout of ₹${amount} successfully initiated via Razorpay (${payoutData.status || 'processed'})!`,
        details: payoutData,
      });
    } else {
      // If RazorpayX direct payout account is not active, generate Payout Link or simulated sandbox response
      const errDesc = payoutData.error?.description || 'Direct payout initiation error';
      
      // Let's create a Razorpay Payout Link fallback if direct account number failed
      try {
        const linkPayload = {
          account_number: razorpayXAccount || '7878780080316316',
          contact: {
            name: name || 'User',
            email: email || undefined,
            contact: phone ? String(phone).replace(/\D/g, '').slice(-10) : undefined,
          },
          amount: amountInPaise,
          currency: 'INR',
          purpose: 'payout',
          description: narration,
          receipt: requestId ? `rec_${String(requestId).slice(0, 20)}` : `rec_${Date.now()}`,
          send_sms: Boolean(phone),
          send_email: Boolean(email),
        };

        const linkRes = await fetch('https://api.razorpay.com/v1/payout-links', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkPayload),
        });

        const linkData = await linkRes.json();
        if (linkRes.ok) {
          return res.json({
            success: true,
            isPayoutLink: true,
            payoutLinkId: linkData.id,
            payoutLinkUrl: linkData.short_url,
            status: linkData.status || 'issued',
            amount: amount,
            message: `Razorpay Payout Link created: ${linkData.short_url}`,
            details: linkData,
          });
        }
      } catch (linkErr) {
        console.warn('Payout link fallback error:', linkErr);
      }

      return res.status(payoutRes.status).json({
        success: false,
        message: errDesc,
        error: payoutData.error,
      });
    }
  } catch (err) {
    console.error('Razorpay payout processing error:', err);
    return res.status(500).json({
      success: false,
      message: `Payout processing error: ${err.message}`,
    });
  }
});

// ── 5. POST /api/razorpay/create-payout-link ───────────────────
app.post('/api/razorpay/create-payout-link', async (req, res) => {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay is not configured.',
      });
    }

    const { requestId, name, email, phone, amountInr, description = 'Withdrawal Payout' } = req.body;
    const amount = Number(amountInr);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount.' });
    }

    const razorpayXAccount = razorpayConfig.accountNumber || process.env.RAZORPAY_ACCOUNT_NUMBER;

    const payload = {
      account_number: razorpayXAccount || '7878780080316316',
      contact: {
        name: name || 'User',
        email: email || undefined,
        contact: phone ? String(phone).replace(/\D/g, '').slice(-10) : undefined,
      },
      amount: Math.round(amount * 100),
      currency: 'INR',
      purpose: 'payout',
      description: description,
      receipt: requestId ? `rcpt_${String(requestId).slice(0, 20)}` : `rcpt_${Date.now()}`,
      send_sms: Boolean(phone),
      send_email: Boolean(email),
    };

    const linkRes = await fetch('https://api.razorpay.com/v1/payout-links', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const linkData = await linkRes.json();
    if (linkRes.ok) {
      return res.json({
        success: true,
        payoutLinkId: linkData.id,
        payoutLinkUrl: linkData.short_url,
        status: linkData.status,
        amount: amount,
        message: 'Razorpay Payout Link generated successfully!',
        details: linkData,
      });
    } else {
      return res.status(linkRes.status).json({
        success: false,
        message: linkData.error?.description || 'Could not generate Razorpay Payout Link.',
        error: linkData.error,
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ── 6. POST /api/razorpay/webhook ──────────────────────────────
app.post('/api/razorpay/webhook', (req, res) => {
  const secret = razorpayConfig.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  if (secret && signature) {
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      return res.status(400).json({ status: 'invalid_signature' });
    }
  }

  const event = req.body.event;
  const payload = req.body.payload;
  console.log(`[Razorpay Webhook Received] Event: ${event}`);

  // Returns 200 OK to Razorpay
  res.json({ status: 'ok', receivedEvent: event });
});

// ── Static Files & SPA Fallback ────────────────────────────────
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Self Attendance Pro Server running on http://0.0.0.0:${PORT}`);
});
