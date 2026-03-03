const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDocs() {
  const ids = ["l9be4szQ7NuuppwAvZnw", "tlkUdAYZjccZnJXb2mnM"];
  for (const id of ids) {
    const doc = await db.collection("transactions").doc(id).get();
    if (doc.exists) {
      console.log(`Document ${id} exists:`, JSON.stringify(doc.data(), null, 2));
    } else {
      console.log(`Document ${id} does NOT exist.`);
    }
  }
}

checkDocs();
