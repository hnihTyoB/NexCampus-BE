/**
 * test-ai-flow.ts
 * Script automation to test login, POST /ai-suggestion, and POST / (save weekly evaluation).
 * Run: npx tsx scripts/test-ai-flow.ts
 */

async function run() {
  console.log("🚀 Starting AI Weekly Evaluation flow test...\n");

  const BASE_URL = "http://localhost:8888/api/v1";

  // Step 1: Login as Leader
  console.log("🔑 Step 1: Logging in as leader...");
  const loginResp = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "leader@nexcampus.local",
      password: "Leader@123456",
    }),
  });

  if (!loginResp.ok) {
    const errorText = await loginResp.text();
    console.error("❌ Login failed:", errorText);
    process.exit(1);
  }

  const loginData = (await loginResp.json()) as {
    success: boolean;
    data: { accessToken: string };
  };
  const token = loginData.data.accessToken;
  console.log("✅ Logged in successfully! Token received.\n");

  // Step 2: Request AI Suggestion
  const internId = "d82c2533-7004-4835-a379-5f4a534a1994";
  const week = 1;

  console.log(
    `🤖 Step 2: Requesting AI Suggestion for intern ${internId}, week ${week}...`,
  );
  console.log("(This might take 5-15 seconds as it calls the Gemini API...)");

  const suggestionResp = await fetch(
    `${BASE_URL}/weekly-evaluations/ai-suggestion`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ internId, week }),
    },
  );

  if (!suggestionResp.ok) {
    const errorText = await suggestionResp.text();
    console.error("❌ AI Suggestion request failed:", errorText);
    process.exit(1);
  }

  const suggestionResult = (await suggestionResp.json()) as {
    success: boolean;
    data: {
      communication: number;
      attitude: number;
      learning: number;
      coding: number;
      comment: string;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
    };
  };

  console.log("✅ AI Suggestion Response:");
  console.log(JSON.stringify(suggestionResult.data, null, 2));
  console.log();

  // Step 3: Save evaluation with AI fields
  console.log("💾 Step 3: Saving evaluation...");
  const aiData = suggestionResult.data;

  // Let's modify the communication score slightly to simulate the leader editing it
  const leaderCommunication = Math.max(1, aiData.communication - 1);
  console.log(
    `Leader modified communication score from ${aiData.communication} to ${leaderCommunication}.`,
  );

  const savePayload = {
    internId,
    week,
    communication: leaderCommunication, // edited
    attitude: aiData.attitude, // same as AI
    learning: aiData.learning, // same as AI
    coding: aiData.coding, // same as AI
    comment:
      "Đã chỉnh sửa điểm giao tiếp của bạn. Hãy cố gắng báo cáo đúng hạn hơn.",

    // AI suggestions stored as reference
    aiCommunication: aiData.communication,
    aiAttitude: aiData.attitude,
    aiLearning: aiData.learning,
    aiCoding: aiData.coding,
    aiComment: aiData.comment,
  };

  const saveResp = await fetch(`${BASE_URL}/weekly-evaluations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(savePayload),
  });

  if (!saveResp.ok) {
    const errorText = await saveResp.text();
    console.error("❌ Save evaluation failed:", errorText);
    process.exit(1);
  }

  const saveResult = await saveResp.json();
  console.log("✅ Save Evaluation Response (from DB):");
  console.log(JSON.stringify(saveResult, null, 2));

  console.log("\n🎉 Test flow completed successfully!");
}

run().catch((err) => {
  console.error("Fatal test error:", err);
});
