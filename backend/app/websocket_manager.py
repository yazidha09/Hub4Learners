from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.friend_rooms: dict[str, list[WebSocket]] = defaultdict(list)
        self.user_rooms: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect_friend(self, room_id: str, ws: WebSocket):
        await ws.accept()
        self.friend_rooms[room_id].append(ws)

    def disconnect_friend(self, room_id: str, ws: WebSocket):
        conns = self.friend_rooms.get(room_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_friend(self, room_id: str, payload: dict):
        dead: list[WebSocket] = []
        for ws in list(self.friend_rooms.get(room_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_friend(room_id, ws)

    async def connect_user(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.user_rooms[user_id].append(ws)

    def disconnect_user(self, user_id: str, ws: WebSocket):
        conns = self.user_rooms.get(user_id, [])
        if ws in conns:
            conns.remove(ws)

    async def notify_user(self, user_id: str, payload: dict):
        dead: list[WebSocket] = []
        for ws in list(self.user_rooms.get(user_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_user(user_id, ws)


manager = ConnectionManager()
