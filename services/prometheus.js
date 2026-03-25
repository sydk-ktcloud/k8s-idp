const axios = require("axios");

async function queryPrometheus(query) {
  try {
    const baseUrl = process.env.PROMETHEUS_URL;

    if (!baseUrl) {
      throw new Error("PROMETHEUS_URL이 .env에 설정되지 않았습니다.");
    }

    const res = await axios.get(`${baseUrl}/api/v1/query`, {
      params: { query },
      timeout: 5000,
    });

    if (res.data?.status !== "success") {
      throw new Error("Prometheus query failed");
    }

    return res.data?.data?.result || [];
  } catch (err) {
    console.error(
      "Prometheus query error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

function extractFirstValue(result) {
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const first = result[0];
  const rawValue = first?.value?.[1];

  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const num = Number(rawValue);
  return Number.isFinite(num) ? num : null;
}

async function queryPrometheusScalar(query) {
  const result = await queryPrometheus(query);
  return extractFirstValue(result);
}

module.exports = {
  queryPrometheus,
  queryPrometheusScalar,
  extractFirstValue,
};