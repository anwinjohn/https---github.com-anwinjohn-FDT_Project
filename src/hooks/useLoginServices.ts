import axios from 'axios';
import { appConfig as config } from '../config/runtime-config';

const ApiUrl = config.api.userInfo;

const localAgentClient = axios.create({
  baseURL: `${ApiUrl}`,
  method: 'GET',
  timeout: 10000,
});

export async function fetchLocalMachineInfo() {
  try {
    const response = await localAgentClient.get('');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.code === 'ECONNABORTED'
          ? 'Local agent timeout'
          : 'Local agent not running',
    };
  }
}
