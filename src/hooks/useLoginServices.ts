import axios from "axios";

const localAgentClient = axios.create({
  baseURL: "http://localhost:5050/users",
  method:'GET',
  timeout: 10000,
});

export async function fetchLocalMachineInfo() {
  try {
    const response = await localAgentClient.get("");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.code === "ECONNABORTED"
          ? "Local agent timeout"
          : "Local agent not running",
    };
  }
}
