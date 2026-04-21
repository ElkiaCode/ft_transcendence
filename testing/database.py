import subprocess


def run_sql(sql: str) -> str:
    result = subprocess.run(
        [
            "docker", "compose", "exec", "-T",
            "postgres",
            "sh", "-lc",
            'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
        ],
        input=sql,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("SQL ERROR:")
        print(result.stderr)
        return ""

    return result.stdout


def check_tables():
    sql = r'\dt'
    print(run_sql(sql))


def check_database_user():
    sql = 'SELECT id, email, username, "globalRole", "isActive", "isBanned", "penaltyPoints", "preferredLanguage", "createdAt" FROM "User" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_profiles():
    sql = 'SELECT id, "userId", "displayName", bio, "avatarUrl", "createdAt" FROM "Profile" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_oauth_accounts():
    sql = 'SELECT id, "userId", provider, "providerAccountId", "createdAt" FROM "OAuthAccount" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_refresh_tokens():
    sql = 'SELECT id, "userId", "tokenHash", "expiresAt", "revokedAt", "createdAt" FROM "RefreshToken" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_active_refresh_tokens():
    sql = 'SELECT id, "userId", "expiresAt", "createdAt" FROM "RefreshToken" WHERE "revokedAt" IS NULL AND "expiresAt" > NOW() ORDER BY "createdAt";'
    print(run_sql(sql))


def check_revoked_refresh_tokens():
    sql = 'SELECT id, "userId", "revokedAt", "createdAt" FROM "RefreshToken" WHERE "revokedAt" IS NOT NULL ORDER BY "createdAt";'
    print(run_sql(sql))


def check_friendships():
    sql = 'SELECT id, "requesterId", "addresseeId", status, "createdAt", "updatedAt" FROM "Friendship" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_accepted_friendships():
    sql = "SELECT id, \"requesterId\", \"addresseeId\", status FROM \"Friendship\" WHERE status = 'ACCEPTED' ORDER BY \"createdAt\";"
    print(run_sql(sql))


def check_pending_friendships():
    sql = "SELECT id, \"requesterId\", \"addresseeId\", status FROM \"Friendship\" WHERE status = 'PENDING' ORDER BY \"createdAt\";"
    print(run_sql(sql))


def check_blocks():
    sql = 'SELECT id, "blockerId", "blockedId", "createdAt" FROM "Block" ORDER BY "createdAt";'
    print(run_sql(sql))


def check_users_with_profiles():
    sql = """
    SELECT
      u.id,
      u.email,
      u.username,
      u."globalRole",
      u."isActive",
      u."isBanned",
      p."displayName",
      p.bio,
      p."avatarUrl"
    FROM "User" u
    LEFT JOIN "Profile" p ON p."userId" = u.id
    ORDER BY u."createdAt";
    """
    print(run_sql(sql))


def check_friendships_with_usernames():
    sql = """
    SELECT
      f.id,
      r.username AS requester,
      a.username AS addressee,
      f.status,
      f."createdAt"
    FROM "Friendship" f
    JOIN "User" r ON r.id = f."requesterId"
    JOIN "User" a ON a.id = f."addresseeId"
    ORDER BY f."createdAt";
    """
    print(run_sql(sql))


def check_blocks_with_usernames():
    sql = """
    SELECT
      b.id,
      blocker.username AS blocker,
      blocked.username AS blocked,
      b."createdAt"
    FROM "Block" b
    JOIN "User" blocker ON blocker.id = b."blockerId"
    JOIN "User" blocked ON blocked.id = b."blockedId"
    ORDER BY b."createdAt";
    """
    print(run_sql(sql))


def check_user_by_email(email: str):
    sql = f"""
    SELECT id, email, username, "globalRole", "isActive", "isBanned"
    FROM "User"
    WHERE email = '{email}';
    """
    print(run_sql(sql))


def check_refresh_tokens_by_email(email: str):
    sql = f"""
    SELECT rt.id, rt."expiresAt", rt."revokedAt", rt."createdAt"
    FROM "RefreshToken" rt
    JOIN "User" u ON u.id = rt."userId"
    WHERE u.email = '{email}'
    ORDER BY rt."createdAt";
    """
    print(run_sql(sql))

def check_conversation():
    sql = f"""
    SELECT id, type, title, "createdAt", "updatedAt"
    FROM "Conversation"
    ORDER BY "createdAt";
    """
    print(run_sql(sql))

def check_conversation_participant():
    sql = f"""
    SELECT id, "conversationId", "userId", role, "joinedAt"
    FROM "ConversationParticipant"
    ORDER BY "joinedAt";
    """
    print(run_sql(sql))

def check_conversation_message():
    sql = f"""
    SELECT id, "conversationId", "senderId", content, type, "createdAt"
    FROM "Message"
    ORDER BY "createdAt";
    """
    print(run_sql(sql))

def check_notification():
    sql = f"""
    SELECT id, "userId", type, title, body, "isRead", "createdAt"
    FROM "Notification"
    ORDER BY "createdAt" DESC;
    """
    print(run_sql(sql))

def check_unread_notification():
    sql = f"""
    SELECT id, "userId", type, title, body, "createdAt"
    FROM "Notification"
    WHERE "isRead" = false
    ORDER BY "createdAt" DESC;
    """
    print(run_sql(sql))

def check_notification_username():
    sql = f"""
    SELECT
    n.id,
    u.username,
    n.type,
    n.title,
    n.body,
    n."isRead",
    n."createdAt"
    FROM "Notification" n
    JOIN "User" u ON u.id = n."userId"
    ORDER BY n."createdAt" DESC;
    """
    print(run_sql(sql))

def check_all_report():
    sql = f"""
    SELECT
    id,
    "creatorId",
    "targetType",
    "targetUserId",
    "targetMessageId",
    reason,
    status,
    "createdAt",
    "updatedAt"
    FROM "Report"
    ORDER BY "createdAt" DESC;
    """
    print(run_sql(sql))

def check_open_report():
    sql = f"""
    SELECT
    id,
    "creatorId",
    "targetType",
    "targetUserId",
    "targetMessageId",
    reason,
    status,
    "createdAt"
    FROM "Report"
    WHERE status = 'OPEN'
    ORDER BY "createdAt" DESC;
    """
    print(run_sql(sql))

def check_resolved_report():
    sql = f"""
    SELECT
    id,
    "creatorId",
    "targetType",
    "targetUserId",
    "targetMessageId",
    reason,
    status,
    "createdAt",
    "updatedAt"
    FROM "Report"
    WHERE status = 'RESOLVED'
    ORDER BY "updatedAt" DESC;
    """
    print(run_sql(sql))

def check_moderation_action():
    sql = f"""
    SELECT
    id,
    "reportId",
    "moderatorId",
    "targetUserId",
    action,
    note,
    "createdAt"
    FROM "ModerationAction"
    ORDER BY "createdAt" DESC;
    """
    run_sql(sql)

def count_rows():
    queries = [
        'SELECT COUNT(*) AS users FROM "User";',
        'SELECT COUNT(*) AS profiles FROM "Profile";',
        'SELECT COUNT(*) AS oauth_accounts FROM "OAuthAccount";',
        'SELECT COUNT(*) AS refresh_tokens FROM "RefreshToken";',
        'SELECT COUNT(*) AS friendships FROM "Friendship";',
        'SELECT COUNT(*) AS blocks FROM "Block";',
        'SELECT COUNT(*) AS conversation FROM "Conversation";',
        'SELECT COUNT(*) AS conversation_participant FROM "ConversationParticipant";',
        'SELECT COUNT(*) AS message FROM "Message";',
        'SELECT COUNT(*) AS notifications_count FROM "Notification";',
        'SELECT COUNT(*) AS reports_count FROM "Report";',
        'SELECT COUNT(*) AS moderation_actions_count FROM "ModerationAction";'
    ]

    for sql in queries:
        print(run_sql(sql))


def full_database_audit():
    print("=== TABLES ===")
    check_tables()

    print("=== USERS ===")
    check_database_user()

    print("=== PROFILES ===")
    check_profiles()

    print("=== OAUTH ACCOUNTS ===")
    check_oauth_accounts()

    print("=== REFRESH TOKENS ===")
    check_refresh_tokens()

    print("=== ACTIVE REFRESH TOKENS ===")
    check_active_refresh_tokens()

    print("=== REVOKED REFRESH TOKENS ===")
    check_revoked_refresh_tokens()

    print("=== FRIENDSHIPS ===")
    check_friendships()

    print("=== ACCEPTED FRIENDSHIPS ===")
    check_accepted_friendships()

    print("=== PENDING FRIENDSHIPS ===")
    check_pending_friendships()

    print("=== BLOCKS ===")
    check_blocks()

    print("=== USERS WITH PROFILES ===")
    check_users_with_profiles()

    print("=== FRIENDSHIPS WITH USERNAMES ===")
    check_friendships_with_usernames()

    print("=== BLOCKS WITH USERNAMES ===")
    check_blocks_with_usernames()

    print("=== CONVERSATIONS ===")
    check_conversation()

    print("=== CONVERSATION WITH PARTICIPANTS ===")
    check_conversation_participant()

    print("=== CONVERSATION MESSAGES ===")
    check_conversation_message()

    print("=== NOTIFICATION ===")
    check_notification()

    print("=== UNREAD NOTIFICATION ===")
    check_unread_notification()

    print("=== NOTIFICATION USERNAME ===")
    check_notification_username()

    print("=== REPORT ===")
    check_all_report()

    print("=== OPEN REPORT ===")
    check_open_report()

    print("=== RESOLVED REPORT ===")
    check_resolved_report()

    print("=== MODERATION ACTION ===")
    check_moderation_action()

    print("=== COUNTS ===")
    count_rows()
