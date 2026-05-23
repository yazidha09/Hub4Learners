# Sprint 5 — Communication & Community

**Weeks 9–10**

## Introduction

Sprint 5 turns Hub4Learners into a place where learners and professors actually interact. Three communication channels ship in parallel: lesson-level discussion threads with votes and reports, real-time friend messaging with text and media, and a student-to-professor chat-request flow. A unified notification system keeps every important event visible across the app.

## Sprint Goal

> Enable real-time communication across the platform through discussions, friend messaging, professor chat requests, and live notifications.

---

## User Stories

### Discussions

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-5.1 | High | As a user, I can post a discussion message on a specific lesson | T-5.1.1: Post endpoint · T-5.1.2: Thread UI |
| US-5.2 | High | As a user, I can reply to a post and create a nested thread | T-5.2.1: Reply endpoint |
| US-5.3 | Medium | As a user, I can upvote posts (one vote per user) | T-5.3.1: Toggle vote endpoint |
| US-5.4 | Medium | As a user, I can report inappropriate posts | T-5.4.1: Report endpoint |
| US-5.5 | Medium | As a user, I can request an AI-generated summary of a long thread | T-5.5.1: Summary endpoint · T-5.5.2: Cached summary |
| US-5.6 | Medium | As an author, I can edit my own post; admins can soft-delete any post | T-5.6.1: Edit / delete endpoints |

### Friend Messaging

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-5.7 | High | As a user, I can chat with my friends in real time | T-5.7.1: Message endpoint · T-5.7.2: WebSocket broadcast |
| US-5.8 | Medium | As a user, I can send images or files as attachments | T-5.8.1: Media upload · T-5.8.2: Inline preview |
| US-5.9 | Medium | As a user, I can view my full message history with a friend | T-5.9.1: History endpoint |

### Professor Chat Requests

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-5.10 | High | As a student, I can send a chat request to a professor | T-5.10.1: Request endpoint |
| US-5.11 | High | As a professor, I can accept or refuse chat requests | T-5.11.1: Review endpoint |
| US-5.12 | Medium | As a professor, I can toggle auto-refuse to decline new requests automatically | T-5.12.1: Auto-refuse setting |
| US-5.13 | High | As both sides, once accepted I can exchange messages in real time | T-5.13.1: Chat room WebSocket · T-5.13.2: Message persistence |

### Notifications & Announcements

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-5.14 | High | As a user, I receive live notifications for relevant events (messages, requests, enrollments, role changes) | T-5.14.1: Notification push · T-5.14.2: Bell + unread badge |
| US-5.15 | Medium | As a user, I can mark notifications as read or clear them all | T-5.15.1: Read / clear endpoints |
| US-5.16 | Medium | As a university admin, I can post an announcement that fans out to my university | T-5.16.1: Announcement endpoint · T-5.16.2: Recipient fan-out |

---

## Related Diagrams

### C4 Component View — Communication Domain

```mermaid
graph TD
    A["React Frontend<br/>(Discussions · Messages · Notifications)"] -->|REST| B["discussion_routes.py"]
    A -->|REST| C["chat_routes.py + friend_routes.py"]
    A -->|REST| D["notification_routes.py + announcement_routes.py"]
    A -. WS .-> E["ws_routes.py<br/>/ws/notifications · /ws/chat · /ws/friends"]
    B --> F["discussion_controller<br/>posts · votes · reports · summary"]
    C --> G["chat_controller + friend_controller"]
    D --> H["notification_controller + announcements"]
    E --> I["websocket_manager<br/>(user · chat · friend rooms)"]
    F --> J["SQLAlchemy ORM"]
    G --> J
    H --> J
    J -->|SQL| K[(Neon PostgreSQL)]
```

### Class Diagram — Communication Entities

```mermaid
classDiagram
    class DiscussionPost {
        UUID id
        UUID subsection_id
        UUID author_id
        UUID parent_post_id
        string content
        int upvote_count
        int reply_count
    }

    class DiscussionVote {
        UUID post_id
        UUID user_id
    }

    class DiscussionReport {
        UUID post_id
        UUID reporter_id
        string reason
    }

    class FriendMessage {
        UUID id
        UUID friendship_id
        UUID sender_id
        string content
        string media_url
        string media_type
    }

    class ChatRequest {
        UUID id
        UUID student_id
        UUID professor_id
        string status
    }

    class Message {
        UUID id
        UUID chat_request_id
        UUID sender_id
        string content
    }

    class Notification {
        UUID id
        UUID user_id
        string type
        string title
        string body
        bool is_read
    }

    class Announcement {
        UUID id
        UUID university_id
        string title
        string body
    }

    DiscussionPost "0..*" --> "0..1" DiscussionPost
    DiscussionVote "*" --> "1" DiscussionPost
    DiscussionReport "*" --> "1" DiscussionPost
    Message "*" --> "1" ChatRequest
    FriendMessage "*" --> "1" Friendship
    Notification "*" --> "1" User
```

### Use Case Diagram — Communication & Community

```mermaid
graph LR
    S((Student))
    P((Professor))
    UA((University Admin))

    UC1([Post in Discussion])
    UC2([Reply to Post])
    UC3([Upvote Post])
    UC4([Report Post])
    UC5([Summarize Thread])
    UC6([Send Friend Message])
    UC7([Send Media Attachment])
    UC8([Send Chat Request])
    UC9([Accept / Refuse Request])
    UC10([Toggle Auto-Refuse])
    UC11([Receive Notifications])
    UC12([Post Announcement])

    S --> UC1
    S --> UC2
    S --> UC3
    S --> UC4
    S --> UC5
    S --> UC6
    S --> UC7
    S --> UC8
    S --> UC11
    P --> UC1
    P --> UC2
    P --> UC6
    P --> UC9
    P --> UC10
    P --> UC11
    UA --> UC12
    UA --> UC11
```

### Sequence Diagram — Real-Time Friend Messaging

```mermaid
sequenceDiagram
    actor UserA
    actor UserB
    participant FA as Frontend A
    participant FB as Frontend B
    participant Backend
    participant DB as Database
    participant WS as WebSocket Manager

    Note over FA,Backend: Establish WS connections (auth via query token)

    UserA->>FA: Open chat
    FA->>+Backend: WS /ws/friends/{id}?token=JWT
    Backend->>Backend: Decode + verify JWT
    alt Invalid token
        Backend-->>FA: close(1008)
    else Valid
        Backend->>WS: register socket in friend_room
        Backend-->>-FA: accepted
    end

    UserB->>FB: Open chat
    FB->>Backend: WS /ws/friends/{id}?token=JWT
    Backend->>WS: register socket in friend_room

    Note over FA,WS: Real-time message exchange

    UserA->>FA: Type message + send
    FA->>+Backend: POST /friends/{id}/messages (Bearer token)
    Backend->>Backend: Authenticate
    Backend->>+DB: INSERT FriendMessage + Notification (for B)
    DB-->>-Backend: rows
    Backend->>+WS: broadcast to friend_room
    par Broadcast to all connected sockets
        WS-->>FA: message frame
    and
        WS-->>FB: message frame
    end
    WS-->>-Backend: done
    Backend-->>-FA: FriendMessageOut
```

### Sequence Diagram — Discussion Post, Vote & AI Summary

```mermaid
sequenceDiagram
    actor Student
    participant Frontend
    participant Backend
    participant DB as Database
    participant Gemini

    Student->>Frontend: Submit comment
    Frontend->>+Backend: POST /discussions/subsections/{id}
    Backend->>Backend: Authenticate
    Backend->>+DB: INSERT DiscussionPost
    DB-->>-Backend: row
    Backend-->>-Frontend: 201 post

    Note over Student,Backend: Upvote toggle (idempotent)

    Student->>Frontend: Click upvote
    Frontend->>+Backend: POST /discussions/{post_id}/vote
    Backend->>+DB: SELECT existing DiscussionVote
    DB-->>-Backend: result
    alt Already voted
        Backend->>+DB: DELETE vote
        DB-->>-Backend: ok
        Backend->>Backend: Decrement upvote_count
    else Not voted yet
        Backend->>+DB: INSERT vote (UNIQUE post_id, user_id)
        DB-->>-Backend: ok
        Backend->>Backend: Increment upvote_count
    end
    Backend-->>-Frontend: DiscussionVoteOut

    Note over Student,Backend: Generate AI summary of the thread

    Student->>Frontend: Click "Summarize"
    Frontend->>+Backend: POST /discussions/subsections/{id}/summary/regenerate
    Backend->>+DB: SELECT all posts in thread
    DB-->>-Backend: posts
    alt Not enough posts
        Backend-->>Frontend: 400 Need more posts
    else Enough posts
        Backend->>+Gemini: Prompt(thread → markdown)
        Gemini-->>-Backend: summary_md
        Backend->>+DB: UPSERT DiscussionSummary
        DB-->>-Backend: ok
        Backend-->>-Frontend: DiscussionSummaryOut
    end
```

---

## Conclusion

Sprint 5 turns the platform into a community. WebSocket-driven messaging keeps conversations alive in real time, discussions add a learning-focused forum to each lesson, and the unified notification system makes sure no important event is missed. With Sprint 6 left, only monetisation and administration remain.
