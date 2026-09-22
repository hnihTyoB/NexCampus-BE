async function main() {
  // 1. Login as leader.qa
  const loginRes = await fetch("http://localhost:9999/api/v2/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "leader.qa@nexcampus.com",
      password: "Leader@123456",
    }),
  });

  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status, "success:", loginData.success);
  if (!loginData.success) {
    console.error("Login failed:", loginData);
    return;
  }

  const token = loginData.data.accessToken;

  // 2. Request GET /api/v2/tasks?limit=10 (Default call made by LeaderTableTasks)
  const tasksRes = await fetch("http://localhost:9999/api/v2/tasks?limit=10", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const tasksData = await tasksRes.json();
  console.log("GET /api/v2/tasks?limit=10 status:", tasksRes.status);
  console.log("Response:", JSON.stringify(tasksData, null, 2));

  // 3. Request with taskGroupId if available
  const groupsRes = await fetch("http://localhost:9999/api/v2/task-groups", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groupsData = await groupsRes.json();
  console.log("Task groups count:", groupsData.data?.length);
  if (groupsData.data?.length > 0) {
    const groupId = groupsData.data[0].id;
    console.log("Testing with taskGroupId:", groupId);
    const groupTasksRes = await fetch(`http://localhost:9999/api/v2/tasks?taskGroupId=${groupId}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const groupTasksData = await groupTasksRes.json();
    console.log("Group tasks response:", JSON.stringify(groupTasksData, null, 2));
  }
}

main().catch(console.error);
