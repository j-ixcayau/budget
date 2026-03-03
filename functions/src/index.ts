import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

admin.initializeApp();
const db = admin.firestore();

export const logApplePayTransaction = onRequest(async (request, response) => {
  logger.info("Incoming transaction request", { 
    method: request.method,
    headers: request.headers,
    body: request.body 
  });

  try {
    const apiKey = request.headers["x-api-key"];

    if (apiKey !== process.env.API_SECRET_KEY) {
      logger.warn("Unauthorized request: API key mismatch");
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (request.method !== "POST") {
      logger.warn(`Method not allowed: ${request.method}`);
      response.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const data = request.body;
    const { userId, amount, merchant, date, currency, category, note } = data;

    if (!userId || amount === undefined || amount === null || !currency) {
      logger.warn("Missing required fields", { userId, amount, currency });
      response.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Safe date parsing
    let transactionDate;
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        transactionDate = admin.firestore.Timestamp.fromDate(parsedDate);
      } else {
        logger.warn("Invalid date provided, falling back to server timestamp", { date });
        transactionDate = admin.firestore.FieldValue.serverTimestamp();
      }
    } else {
      transactionDate = admin.firestore.FieldValue.serverTimestamp();
    }

    const transactionData = {
      userId,
      amount: parseFloat(amount),
      currency: currency || "Q",
      category: category || "Other",
      type: "expense",
      date: transactionDate,
      note: note || `Apple Pay: ${merchant || "Unknown Merchant"}`,
    };

    logger.info("Attempting to save transaction to Firestore", { transactionData });
    const docRef = await db.collection("transactions").add(transactionData);
    logger.info("Transaction saved successfully", { docId: docRef.id });

    response.json({
      success: true,
      id: docRef.id,
      message: "Transaction logged successfully",
    });
  } catch (error: any) {
    logger.error("Function Error", { error: error.message, stack: error.stack });
    response.status(500).json({ error: error.message });
  }
});
