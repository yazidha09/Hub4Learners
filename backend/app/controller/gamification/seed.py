"""
Default catalog for achievements and badges. `seed_gamification` is called on
startup and is idempotent — existing rows (matched by `code`) are left alone.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.gamification import Achievement, Badge


# code → (title, description, icon, xp_reward, category)
DEFAULT_ACHIEVEMENTS = [
    ("first_lesson",     "First Lesson Completed", "Complete your very first lesson.",      "book",     25,  "learning"),
    ("five_lessons",     "Getting Started",        "Complete 5 lessons.",                   "books",    50,  "learning"),
    ("twenty_lessons",   "Eager Learner",          "Complete 20 lessons.",                  "graduate", 150, "learning"),
    ("first_quiz",       "Quiz Rookie",            "Pass your first quiz.",                 "check",    25,  "quiz"),
    ("quiz_master",      "Quiz Master",            "Pass 10 quizzes.",                      "target",   200, "quiz"),
    ("perfect_quiz",     "Perfect Score",          "Get 100% on any quiz.",                 "star",     100, "quiz"),
    ("streak_3",         "On a Roll",              "Reach a 3-day streak.",                 "flame",     50, "streak"),
    ("streak_7",         "7 Day Streak",           "Reach a 7-day streak.",                 "flame",    100, "streak"),
    ("streak_30",        "Unstoppable",            "Reach a 30-day streak.",                "flame",    500, "streak"),
    ("xp_1000",          "1,000 XP Earned",        "Earn a total of 1,000 XP.",             "bolt",     100, "xp"),
    ("xp_5000",          "5,000 XP Earned",        "Earn a total of 5,000 XP.",             "bolt",     250, "xp"),
    ("xp_10000",         "10,000 XP Earned",       "Earn a total of 10,000 XP.",            "bolt",     500, "xp"),
    ("level_5",          "Level 5",                "Reach level 5.",                        "shield",   100, "level"),
    ("level_10",         "Level 10",               "Reach level 10.",                       "shield",   250, "level"),
    ("level_25",         "Level 25",               "Reach level 25.",                       "shield",   500, "level"),
    ("first_course",     "Course Finisher",        "Complete an entire course.",            "diploma",  200, "course"),
    ("course_collector", "Course Collector",       "Complete 5 courses.",                   "diploma",  500, "course"),
    ("python_beginner",  "Python Beginner",        "Complete a course tagged Python.",      "code",     100, "topic"),
    ("early_bird",       "Early Bird",             "Log in before 8 AM (server time).",     "sun",       30, "habit"),
    ("night_owl",        "Night Owl",              "Log in after 10 PM (server time).",     "moon",      30, "habit"),

    # ── Professor-only ───────────────────────────────────────────────────
    ("first_course_published",  "First Course Published",  "Publish your very first course.",                        "diploma",  100, "teaching"),
    ("five_courses_published",  "Course Builder",          "Publish 5 courses.",                                     "books",    400, "teaching"),
    ("first_student",           "First Student",           "Get your first student enrolled.",                       "graduate",  50, "teaching"),
    ("ten_students",            "Class of Ten",            "Reach 10 total enrollments across your courses.",        "graduate", 100, "teaching"),
    ("hundred_students",        "Crowd Pleaser",           "Reach 100 total enrollments across your courses.",       "crown",    500, "popularity"),
    ("five_hundred_students",   "Lecture Hall",            "Reach 500 total enrollments across your courses.",       "crown",   1000, "popularity"),
    ("thousand_students",       "Stadium Speaker",         "Reach 1,000 total enrollments across your courses.",     "trophy",  2000, "popularity"),
    ("first_completion",        "Mission Accomplished",    "A student completes one of your courses.",               "check",    100, "impact"),
    ("ten_completions",         "Mentor",                  "10 students complete your courses.",                     "check",    300, "impact"),
    ("fifty_completions",       "Educator",                "50 students complete your courses.",                     "graduate", 800, "impact"),
    ("hundred_completions",     "Master Educator",         "100 students complete your courses.",                    "trophy",  1500, "impact"),
    ("first_review",            "First Review",            "Receive your first course rating.",                      "star",      50, "feedback"),
    ("highly_rated",            "Highly Rated",            "Maintain a 4.5+ average across 10+ ratings.",            "star",     400, "feedback"),
    ("perfect_rating",          "Five Star Faculty",       "Receive a perfect 5-star rating.",                       "star",     100, "feedback"),
    ("twenty_five_reviews",     "Voice of the Class",      "Collect 25 student ratings.",                            "scroll",   300, "feedback"),
]


# code → (title, description, icon, rarity)
DEFAULT_BADGES = [
    ("rookie",        "Rookie",        "Joined Hub4Learners — welcome!",        "spark",   "common"),
    ("scholar",       "Scholar",       "Reached level 5.",                      "scroll",  "common"),
    ("dedicated",     "Dedicated",     "Reached a 7-day streak.",               "flame",   "rare"),
    ("knowledge",     "Knowledge",     "Earned 5,000 XP.",                      "brain",   "rare"),
    ("champion",      "Champion",      "Reached level 10.",                     "crown",   "rare"),
    ("master",        "Master",        "Reached level 25.",
                                                                                "trophy",  "epic"),
    ("relentless",    "Relentless",    "Reached a 30-day streak.",              "phoenix", "epic"),
    ("course_master", "Course Master", "Completed 5 courses.",                  "diploma", "epic"),
    ("legend",        "Legend",        "Earned 10,000 XP.",                     "star",    "legendary"),
    ("immortal",      "Immortal",      "Reached level 50.",                     "diamond", "legendary"),

    # ── Professor-only badges ──────────────────────────────────────────
    ("educator",          "Educator",          "Published 5 courses.",                                "scroll",  "rare"),
    ("crowd_favorite",    "Crowd Favorite",    "100 total enrollments across your courses.",          "crown",   "rare"),
    ("rising_star",       "Rising Star",       "10 students completed your courses.",                 "spark",   "rare"),
    ("celebrity",         "Celebrity",         "500 total enrollments across your courses.",          "crown",   "epic"),
    ("acclaimed",         "Acclaimed",         "Maintaining 4.5+ rating across 10+ reviews.",         "star",    "epic"),
    ("life_changer",      "Life Changer",      "100 students completed your courses.",                "trophy",  "epic"),
    ("hall_of_fame",      "Hall of Fame",      "1,000 enrollments across your courses.",              "trophy",  "legendary"),
    ("legendary_mentor",  "Legendary Mentor",  "500 students completed your courses.",                "phoenix", "legendary"),
]


def seed_gamification(db: Session) -> None:
    existing_ach = {a.code for a in db.query(Achievement.code).all()}
    for code, title, desc, icon, xp, cat in DEFAULT_ACHIEVEMENTS:
        if code in existing_ach:
            continue
        db.add(Achievement(
            code=code, title=title, description=desc, icon=icon,
            xp_reward=xp, category=cat,
        ))

    existing_b = {b.code for b in db.query(Badge.code).all()}
    for code, title, desc, icon, rarity in DEFAULT_BADGES:
        if code in existing_b:
            continue
        db.add(Badge(
            code=code, title=title, description=desc,
            icon=icon, rarity=rarity,
        ))
    db.commit()
