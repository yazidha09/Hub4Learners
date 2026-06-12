# Hub4Learners — Global Use Case Diagram

```mermaid
usecaseDiagram
    actor Visitor
    actor Student
    actor Professor
    actor "University Admin" as UnivAdmin
    actor "Super Admin" as SuperAdmin

    %% ─── Visitor ─────────────────────────────────────────────────────────────
    usecase "Browse Course Catalog" as UC_V1
    usecase "Register" as UC_V2
    usecase "Login" as UC_V3

    Visitor --> UC_V1
    Visitor --> UC_V2
    Visitor --> UC_V3

    %% ─── Student ─────────────────────────────────────────────────────────────
    usecase "Browse / Filter Courses" as UC_S1
    usecase "View Course Details" as UC_S2
    usecase "Enroll (Free)" as UC_S3
    usecase "Pay & Enroll (Stripe)" as UC_S4
    usecase "Navigate Section / Subsection" as UC_S5
    usecase "Read Lesson Blocks" as UC_S6
    usecase "Mark Subsection Completed" as UC_S7
    usecase "Take QCM Quiz" as UC_S8
    usecase "Ask AI Tutor (RAG)" as UC_S9
    usecase "Post in Discussion Thread" as UC_S10
    usecase "Reply / Upvote / Report Posts" as UC_S11
    usecase "Generate AI Discussion Summary" as UC_S12
    usecase "Rate Course (1-5★)" as UC_S13
    usecase "Manage Friends" as UC_S14
    usecase "Direct Chat" as UC_S15
    usecase "View XP / Level / Streaks" as UC_S16
    usecase "View Learner Analytics" as UC_S17
    usecase "Manage Profile" as UC_S18
    usecase "Receive Notifications" as UC_S19

    Student --> UC_S1
    Student --> UC_S2
    Student --> UC_S3
    Student --> UC_S4
    Student --> UC_S5
    Student --> UC_S6
    Student --> UC_S7
    Student --> UC_S8
    Student --> UC_S9
    Student --> UC_S10
    Student --> UC_S11
    Student --> UC_S12
    Student --> UC_S13
    Student --> UC_S14
    Student --> UC_S15
    Student --> UC_S16
    Student --> UC_S17
    Student --> UC_S18
    Student --> UC_S19

    %% ─── Professor ───────────────────────────────────────────────────────────
    usecase "Create / Edit Course" as UC_P1
    usecase "Set Course Price" as UC_P2
    usecase "Build Curriculum" as UC_P3
    usecase "Add / Reorder Sections" as UC_P4
    usecase "Add / Reorder Subsections" as UC_P5
    usecase "Add Lesson Blocks (text/image/file/code)" as UC_P6
    usecase "Upload PDF → AI Course Generation" as UC_P7
    usecase "Regenerate Subsection via AI" as UC_P8
    usecase "Publish / Unpublish Course" as UC_P9
    usecase "View Enrolled Students" as UC_P10
    usecase "Read Course Feedback" as UC_P11
    usecase "Manage Chat Requests" as UC_P12
    usecase "Request University Join" as UC_P13
    usecase "View Professor Analytics" as UC_P14
    usecase "Direct Chat & Friends" as UC_P15
    usecase "Manage Profile" as UC_P16

    Professor --> UC_P1
    Professor --> UC_P2
    Professor --> UC_P3
    Professor --> UC_P4
    Professor --> UC_P5
    Professor --> UC_P6
    Professor --> UC_P7
    Professor --> UC_P8
    Professor --> UC_P9
    Professor --> UC_P10
    Professor --> UC_P11
    Professor --> UC_P12
    Professor --> UC_P13
    Professor --> UC_P14
    Professor --> UC_P15
    Professor --> UC_P16

    %% ─── University Admin ────────────────────────────────────────────────────
    usecase "Review Professor Join Requests" as UC_A1
    usecase "Approve / Reject Join Request" as UC_A2
    usecase "View University Users" as UC_A3
    usecase "Post Announcements" as UC_A4
    usecase "Moderate Discussion Posts" as UC_A5
    usecase "View University Statistics" as UC_A6
    usecase "Manage Profile" as UC_A7

    UnivAdmin --> UC_A1
    UnivAdmin --> UC_A2
    UnivAdmin --> UC_A3
    UnivAdmin --> UC_A4
    UnivAdmin --> UC_A5
    UnivAdmin --> UC_A6
    UnivAdmin --> UC_A7

    %% ─── Super Admin ─────────────────────────────────────────────────────────
    usecase "Create / Rename / Delete Regions" as UC_SU1
    usecase "Create / Move / Delete Universities" as UC_SU2
    usecase "Create / Edit Univ. Admin Accounts" as UC_SU3
    usecase "Ban / Unban Any User" as UC_SU4
    usecase "View Platform-wide Statistics" as UC_SU5
    usecase "Override Moderation Decisions" as UC_SU6

    SuperAdmin --> UC_SU1
    SuperAdmin --> UC_SU2
    SuperAdmin --> UC_SU3
    SuperAdmin --> UC_SU4
    SuperAdmin --> UC_SU5
    SuperAdmin --> UC_SU6
```
