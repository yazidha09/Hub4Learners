from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.utils.security import SECRET_KEY, ALGORITHM
from app.websocket_manager import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/notifications/{user_id}")
async def ws_notifications(
    websocket: WebSocket,
    user_id: str,
    token: str = Query(...),
):
    # Accept first so we can send a proper close frame if auth fails
    await websocket.accept()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") != user_id:
            await websocket.close(code=1008)
            return
    except JWTError:
        await websocket.close(code=1008)
        return

    manager.user_rooms[user_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(user_id, websocket)


@router.websocket("/ws/chat/{request_id}")
async def ws_chat(
    websocket: WebSocket,
    request_id: str,
    token: str = Query(...),
):
    await websocket.accept()
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        await websocket.close(code=1008)
        return

    manager.chat_rooms[request_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_chat(request_id, websocket)


@router.websocket("/ws/friends/{friendship_id}")
async def ws_friend(
    websocket: WebSocket,
    friendship_id: str,
    token: str = Query(...),
):
    await websocket.accept()
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        await websocket.close(code=1008)
        return

    manager.friend_rooms[friendship_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_friend(friendship_id, websocket)
