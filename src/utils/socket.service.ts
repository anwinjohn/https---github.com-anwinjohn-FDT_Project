class SocketService {
  private socket: WebSocket | null = null;

  connect(token: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    const WS_URL = `ws://localhost:8000/ws/alerts?token=${token}`;
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
    };

    this.socket.onmessage = (event) => {
      const response = JSON.parse(event.data);
      console.log('Socket message:', response);
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    this.socket.onclose = () => {
      console.log('WebSocket closed');
      this.socket = null;
    };
  }

  send(data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}

export const socketService = new SocketService();
