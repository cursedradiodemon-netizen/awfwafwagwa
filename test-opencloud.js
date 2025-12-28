require("dotenv").config();

(async () => {
  const key = process.env.ROBLOX_OPEN_CLOUD_KEY;
  const groupId = process.env.ROBLOX_GROUP_ID;

  console.log("KEY:", key ? "FOUND" : "MISSING");
  console.log("GROUP:", groupId || "MISSING");

  const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=10`;

  const res = await fetch(url, {
    headers: {
      "x-api-key": key
    }
  });

  console.log("STATUS:", res.status);
  console.log(await res.text());
})();
