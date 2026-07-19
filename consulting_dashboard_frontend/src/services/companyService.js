import api from "./api";

export const getCompanies = async () => {
  const response = await api.get("/companies");
  return response.data;
};

export const getDashboardKPIs = async () => {
  const response = await api.get("/dashboard-kpis");
  return response.data;
};

export const getInvestmentScores = async () => {
  const response = await api.get("/investment-score");
  return response.data;
};
export const getExecutiveSummary = async () => {
  const response = await api.get("/executive-summary");
  return response.data;
};

export const getLiveCompany = async (symbol) => {
  const response = await api.get(
    `/live-company/${symbol}`
  );

  return response.data;
};