import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

export const logApplePayTransaction = onRequest(async (request, response) => {
  try {
    const apiKey = request.headers["x-api-key"];

    // Validate API Key using environment variable set in Functions config
    if (apiKey !== process.env.API_SECRET_KEY) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (request.method !== "POST") {
      response.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const data = request.body;
    const { userId, amount, merchant, date, currency, category, note } = data;

    if (!userId || !amount || !currency) {
      response.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Prepare transaction data using Admin SDK
    const transactionData = {
      userId,
      amount: parseFloat(amount),
      currency: currency || "Q",
      category: category || "Other",
      type: "expense",
      date: date ? admin.firestore.Timestamp.fromDate(new Date(date)) : admin.firestore.FieldValue.serverTimestamp(),
      note: note || `Apple Pay: ${merchant || "Unknown Merchant"}`,
    };

    // Save to Firestore
    const docRef = await db.collection("transactions").add(transactionData);

    response.json({
      success: true,
      id: docRef.id,
      message: "Transaction logged successfully",
    });
  } catch (error: any) {
    console.error("Function Error:", error);
    response.status(500).json({ error: error.message });
  }
});
