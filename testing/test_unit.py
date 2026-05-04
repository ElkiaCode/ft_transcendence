from users import *
from database import *
import time

#to run this test, database must be empty!

def test_unit1():
#banUser: fail when user, success when moderator or admin (if user/moderator to ban not already banned)
#           fail when moderator or admin tries to ban an already banned user/moderator.
#createOrGetDirectConversation: fail when user, moderator creating a message is banned, 
#           fail when conv to yourself
#           fail when admin, user, moderator sends message to somebody banned
#           else, succeed
#eraseDataPassword: success when user is unbanned and active, else failure
#getMessageConversation: 0 if no conversation started, else the nb of conv
#getMyConversation: void if no conversation started, else all conversation since?
#listReport: fail when user or moderator, success when admin
# login: login fail before registering, login OK
#promoteAdmin: only for tests ; seed should be preferred
#promoteUserToModerator: success if admin promoter, user (if not banned) as promotee; else fail
#reportCreationForUser
# register: registerOK, double register fail
#sendMessageConversation
#unPromoteModeratorToUser: success if admin unpromoter, moderator (even if banned) as promotee; else failure
#unbanUser

    print(f"Creation of user: guillaume, yann, clement...\n")
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    patsy        = User("patsy@gmail.com", "patsy", "totototo")  

    print("guillaume tries to logging without registering:\n")
    res_login = guillaume.login()
    data = res_login.json()
    assert res_login.status_code == 401, "401 expected(unauthorized)"
    
    print("guillaume is registering into the app:\n")
    res_g = guillaume.register()
    data = res_g.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['username'] == "laGuigue06"
    
    print("guillaume is registering into the app a second time:\n")
    res_duplicate = guillaume.register()       
    # ASSERT: Check if it correctly fails with 400
    assert res_duplicate.status_code == 400, "Expected400for duplicate email"
    assert res_duplicate.json()['message'] == "email already in use" 
    
    print("yann is registering into the app:\n")
    yann.register()
    print("clement is registering into the app:\n")
    clement.register()
    print("patsy is registering into the app:\n")
    patsy.register()

    print("guillaume is loging:\n")
    res_login = guillaume.login()
    data = res_login.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['username'] == "laGuigue06"
    print("yann is loging:\n")
    yann.login()
    print("clement is loging:\n")
    clement.login()
    print("patsy is loging:\n")
    patsy.login()  

    print("Guillaume(user, not banned) looks at his conversations\n")
    guillaume.getMyConversation()
    res_my_conv = guillaume.getMyConversation()
    data = res_my_conv.json()
    assert data == [], "data should be empty as no conversations have been created"

    print("Guillaume(user, not banned) looks at his messages\n")
    res_nb = guillaume.getMessageConversation()
    assert res_nb == 0, "0 conversation only!"

    print("Guillaume(user, not banned) creates a conversation with yann\n")
    res_direct_conv = guillaume.createOrGetDirectConversation(yann)
    data = res_direct_conv.json()
    # Check if participants list exists and has members
    assert "participants" in data, "No participants found in conversation"
    assert len(data["participants"]) > 0, "Participants list is empty"
    # Check the role of the first participant
    guillaume_entry = data["participants"][0]
    assert guillaume_entry["role"] == "OWNER", f"Expected OWNER, got {guillaume_entry['role']}"

    print("Guillaume(user, not banned) looks at his conversations\n")
    res_my_conv2 = guillaume.getMyConversation()
    data = res_my_conv2.json()
    # 1. First, ensure it's a list and not empty
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) > 0, "The conversation list is empty!"
    # 2. Access the first conversation in the list
    first_conversation = data[0]
    # 3. Now check the "name" inside that specific dictionary
    assert "name" in first_conversation, "Key 'name' not found in the first conversation"
    assert first_conversation['name'] == "MegaYann", f"Expected MegaYann, got {first_conversation['name']}"
    conversation_id = first_conversation['id']

    print("guillaume(user, not banned) sends a message to Yann\n")
    res_sendMessage = guillaume.sendMessageConversation(conversation_id, "salut yann!")
    assert res_sendMessage == "salut yann!", "Message not sent correctly"

    print("Guillaume(user, not banned) looks at his messages\n")
    res_nb = guillaume.getMessageConversation()
    assert res_nb == 1, "1 conversation only!"

    print("guillaume(user, not banned) creates a report for yann\n")
    res_report_creation = guillaume.reportCreationForUser(yann, "spam and abusive content")
    data = res_report_creation.json()
    assert "reason" in data, "reason does not match with what was sent"
    assert data['reason'] == "spam and abusive content"

    print("guillaume(user, not banned) tries to look at the reports\n")
    res_listReportFail = guillaume.listReport()
    assert res_listReportFail.status_code == 403, "Expected 403 for insufficient role"

    print("Guillaume(user, not banned) tries to ban Clement(user)\n")
    res_banFail = guillaume.banUser(clement)
    assert res_banFail.status_code == 403, "403 expected as user cannot ban"

    print("guillaume promoted to admin\n")
    res_promotedToAdmin = guillaume.promoteAdmin()
    assert res_promotedToAdmin == True, "SQL Update failed to promote user"
    res_refreshCookie = guillaume.refreshCookie()
    data = res_refreshCookie.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['globalRole'] == "ADMIN"
   
    print("guillaume(admin) looks at the reports\n")
    res_listReportSuccess = guillaume.listReport()
    data = res_listReportSuccess.json()
     # 1. First, ensure it's a list and is not empty
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) > 0, "The conversation list is empty!"
    # 2. Access the first conversation in the list
    first_conversation = data[0]
    # 3. Now check the "name" inside that specific dictionary
    assert "reason" in first_conversation, "Key 'reason' not found in the first conversation"
    assert first_conversation['reason'] == "spam and abusive content", f"Expected spam and abusive content, got {first_conversation['reason']}"

    print("Guillaume as admin promotes patsy as moderator\n")
    res_promoteModeratorSuccess = guillaume.promoteUserToModerator(patsy)
    data = res_promoteModeratorSuccess.json()
    assert "user" in data, "SQL Update failed to promote user to Moderator"
    assert data['user']['globalRole'] == "MODERATOR", "globalRole not updated to moderator"
    res_refreshCookie = patsy.refreshCookie()
    data = res_refreshCookie.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['globalRole'] == "MODERATOR"

    print("Guillaume(admin) bans Clement(user, banned)\n")
    res_banSuccess = guillaume.banUser(clement)
    data = res_banSuccess.json()
    assert "user" in data, "user missing"
    assert data['user']['isBanned'] == True, "Clement should be banned!"

    print("yann(user, not banned) creates a conversation with yann\n")
    res_direct_conv = yann.createOrGetDirectConversation(yann)
    assert res_direct_conv.status_code == 400, "expected 400 as you can't create a message to yourself"

    print("yann(user, not banned) creates a conversation with clement(user, banned\n")
    res_direct_conv2 = yann.createOrGetDirectConversation(clement)
    assert res_direct_conv2.status_code == 403, "expected 403 as it is forbidden to create a conversation with somebody banned"

    print("yann(user, not banned) creates a conversation with patsy(moderator, not banned\n")
    res_direct_conv3 = yann.createOrGetDirectConversation(patsy)
    data = res_direct_conv3.json()
    # Check if participants list exists and has members
    assert "participants" in data, "No participants found in conversation"
    assert len(data["participants"]) > 0, "Participants list is empty"
    # Check the role of the first participant
    yann_entry = data["participants"][0]
    assert yann_entry["role"] == "OWNER", f"Expected OWNER, got {yann_entry['role']}"

    # print("Guillaume(admin, not banned) tries to ban Clement(user, banned)\n")
    # res_banFail = guillaume.banUser(clement)
    # assert res_banFail.status_code == 401, "401 expected as admin cannot ban somebody already banned"

    # print("patsy(moderator, not banned) tries to ban Clement(user, banned)\n")
    # res_banFail = patsy.banUser(clement)
    # assert res_banFail.status_code == 401, "401 expected as admin cannot ban somebody already banned"

    print("Guillaume(admin) unbans Clement(user, banned)\n")
    res_unbanSuccess = guillaume.banUser(clement)
    data = res_unbanSuccess.json()
    assert "user" in data, "user missing"
    assert data['user']['isBanned'] == True, "Clement should be banned!"

    print("patsy(moderator) looks at the reports\n")
    res_listReportSuccess = patsy.listReport()
    data = res_listReportSuccess.json()
     # 1. First, ensure it's a list and is not empty
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) > 0, "The conversation list is empty!"
    # 2. Access the first conversation in the list
    first_conversation = data[0]
    # 3. Now check the "name" inside that specific dictionary
    assert "reason" in first_conversation, "Key 'reason' not found in the first conversation"
    assert first_conversation['reason'] == "spam and abusive content", f"Expected spam and abusive content, got {first_conversation['reason']}"

    print("patsy(moderator) bans Clement(user)\n")
    res_banSuccess = patsy.banUser(clement)
    data = res_banSuccess.json()
    assert "user" in data, "user missing"
    assert data['user']['isBanned'] == True, "Clement should be banned!"

    print("Guillaume(admin) tries to promote clement(user, banned) as moderator\n")
    res_promoteModFail = guillaume.promoteUserToModerator(clement)
    data = res_promoteModFail.json()
    assert data['statusCode']  == 400, "Clement should not be promoted to moderator as banned"

    print("patsy (moderator) tries to promote clement(user, banned) to moderator\n")
    res_promoteModFail = patsy.promoteUserToModerator(clement)  
    data = res_promoteModFail.json()
    assert data['statusCode']  == 403, "Clement should not be promoted to moderator"

    print("Guillaume as admin tries to unpromote clement(user, banned) to user\n")
    res_unpromoteModFail = guillaume.unPromoteModeratorToUser(clement)
    data = res_unpromoteModFail.json()
    assert data['statusCode'] == 400, "Clement should not be unpromoted as already user"

    print("Clement (user, banned) tries to promote yann as moderator\n")
    res_promoteModFail = clement.promoteUserToModerator(yann)
    data = res_promoteModFail.json()
    assert data['statusCode'] == 401, "Clement should not be promoted to moderator"

    print("yann(user) tries to unban clement(user, banned)\n")
    res_unbanFail = yann.unbanUser(clement)
    data = res_unbanFail.json()
    assert data['statusCode'] == 403, "Yann should not unban another user"

    print("patsy(moderator) unbans clement(user, banned)\n")
    res_unbanTrue = patsy.unbanUser(clement)
    data = res_unbanTrue.json()
    assert "user" in data, "patsy as moderator should be able to unban clement"
    assert data['user']['isBanned'] == False

    print("patsy(moderator, unbanned) tries to promote yann(user, not banned) as moderator\n")
    res_promoteModFail = patsy.promoteUserToModerator(yann)
    data = res_promoteModFail.json()
    assert data['statusCode'] == 403, "expected 403 as Yann should not be promoted to moderator by a moderator"

    print("Guillaume as admin bans patsy(moderator, not banned)\n")
    res_banSuccess = guillaume.banUser(patsy)
    data = res_banSuccess.json()
    assert "user" in data, "user missing"
    assert data['user']['isBanned'] == True, "patsy should be banned!"

    print("patsy(moderator, banned) tries to promote yann(user, not banned) as moderator\n")
    res_promoteModFail = patsy.promoteUserToModerator(yann)
    data = res_promoteModFail.json()
    assert data['statusCode'] == 401, "expected 401 (unauthorized) as moderator is banned"

    print("Guillaume as admin unpromotes patsy(moderator, banned) to user\n")
    res_unpromoteModFail = guillaume.unPromoteModeratorToUser(patsy)
    data = res_unpromoteModFail.json()
    assert data['statusCode'] == 400, "expected 400 (bad request as moderator banned)"

    print("patsy tries to erase all his data\n")
    res_eraseDataFail = patsy.eraseDataPassword()
    data = res_eraseDataFail.json()
    assert data['statusCode'] == 401, "401 expected as user banned"

    print("Guillaume(admin) unbans patsy(moderator, banned)\n")
    res_unpromoteModSuccess = guillaume.unbanUser(patsy)
    data = res_unpromoteModSuccess.json()
    assert data['user']['isBanned'] == False, "patsy should be unbanned!"

    print("guillaume erases all his data\n")
    res_eraseData = guillaume.eraseDataPassword()
    data = res_eraseData.json()
    assert "success" in data, "data should be erased"
    assert data['success'] == True

    print("yann erases all his data\n")
    res_eraseData = yann.eraseDataPassword()
    data = res_eraseData.json()
    assert "success" in data, "data should be erased"
    assert data['success'] == True

    print("clement erases all his data\n")
    clement.eraseDataPassword()
    print("patsy erases all his data\n")
    patsy.eraseDataPassword()

    print("patsy erases all his data\n")
    patsy.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)
    if (os.path.exists(patsy.cookies)):
        os.remove(patsy.cookies)

def test_unit2():
    #acceptFriend: OK
    #adjustPoint:
    #blockUser: OK
    #createGroupRoom
    #full_database_audit: OK
    #getMe
    #getMyFriends
    #getMyNotifications
    #getIncomingRequest: OK
    #getOutcomingRequest: OK
    #inviteUserToGroup
    #leaveConversation
    #logout
    #markOneNotificationsAsRead
    #refreshCookie: OK
    #removeFriend: OK
    #removeUserToGroup
    #renameConversation
    #reportCreationForMessage
    #reportCreationForUser
    #reviewReport
    #searchUser
    #sendFriendRequest: OK
    #unblockUser: OK
    #updateProfile
    #upload_avatar

    print(f"Creation of user: guillaume, yann, clement...\n")
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    patsy        = User("patsy@gmail.com", "HyperPatsy", "pass1234")
    remy        = User("remy@gmail.com", "OutstandingRemy", "pass1234")

    print(f"Registering...\n")
    guillaume.register()
    yann.register()
    clement.register()
    patsy.register()
    remy.register()

    print(f"Logging...\n")
    guillaume.login()
    yann.login()
    clement.login()
    patsy.login()
    remy.login()

    print(f"Guillaume promoted to admin\n")
    guillaume.promoteAdmin()
    guillaume.refreshCookie()
    print(f"Guillaume promoted Patsy as moderator\n")
    guillaume.promoteUserToModerator(patsy)
   
    print("guillaume(admin) requests clement(user) as friend\n")
    res_reqPending = guillaume.sendFriendRequest(clement)
    data = res_reqPending.json()
    assert data['friendship']['status'] == "PENDING", "request should be pending"
    assert data['target']['username'] == "SuperClem"
    guillaumeId = data['actor']['id']

    print("clement(user) blocks guillaume(admin) as friend\n")
    res_reqBlock = clement.blockUser(guillaume)
    data = res_reqBlock.json()
    assert data['block']['blockedId'] == guillaumeId, "Id should correspond to blocked user" 
    assert data['friendshipRemoved'] == True

    print("guillaume(admin) tries to unblocks clement(user) as friend\n")
    res_reqUnblock = guillaume.unblockUser(clement)
    data = res_reqUnblock.json()
    assert data['statusCode'] == 404, "404 should appear as guillaume never blocked clement"

    print("clement(user) tries to remove guillaume(admin) as friend\n")
    res_removeFriendFail = clement.removeFriend(guillaume)
    data = res_removeFriendFail.json()
    assert data['statusCode'] == 404, "404 should appear as guillaume already blocked"

    print("clement(user) tries to unblock clement(user) as friend\n")
    res_reqUnblockFail = clement.unblockUser(clement)
    data = res_reqUnblockFail.json()
    assert data['statusCode'] == 400, "Bad request as clement tries to unblock himself"

    print("clement(user) unblocks guillaume(admin) as friend\n")
    res_reqUnblock = clement.unblockUser(guillaume)
    data = res_reqUnblock.json()
    assert data['unblockedUserId'] == guillaumeId, "Guillaume should be unblocked"

    print("clement(user) tries to accept yann(user) as friend\n")
    res_acceptFriend = clement.acceptFriend(yann)
    data = res_acceptFriend.json()
    assert data['statusCode'] == 404, "request should not be found as not created"

    print("guillaume(admin) requests clement(user) as friend\n")
    res_reqPending = guillaume.sendFriendRequest(clement)
    data = res_reqPending.json()
    assert data['friendship']['status'] == "PENDING", "request should be pending"
    assert data['target']['username'] == "SuperClem"
    guillaumeId = data['actor']['id']

    print("clement(user) accepts guillaume(admin) as friend\n")
    res_acceptFriend = clement.acceptFriend(guillaume)
    data = res_acceptFriend.json()
    assert data['friendship']['status'] == "ACCEPTED", "request should be accepted"
    guillaumeFriendshipId = data['friendship']['id']

    print("clement(user) removes guillaume(admin) as friend\n")
    res_removeFriend = clement.removeFriend(guillaume)
    data = res_removeFriend.json()
    assert data['removedFriendshipId'] == guillaumeFriendshipId, "Request should correspond to requester Id"

    print("yann(user) requests remy(user) as friend\n")
    res_reqPending = yann.sendFriendRequest(remy)
    data = res_reqPending.json()
    assert data['friendship']['status'] == "PENDING", "request should be pending"
    assert data['target']['username'] == "OutstandingRemy"
    yannRequesterId = data['actor']['id']

    print("remy(user) gets incoming requests\n")
    res_IncReq = remy.getIncomingRequest()
    data = res_IncReq.json()
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) > 0, "The conversation list is empty!"
    first_conversation = data[0]
    assert first_conversation['user']['displayName'] == "MegaYann", "MegaYann should be displayed"

    print("yann(user) gets incoming requests\n")
    res_IncReq = yann.getIncomingRequest()
    data = res_IncReq.json()
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) == 0, "The conversation list should be empty!"

    print("remy(user) gets outcoming requests\n")
    res_IncReq = remy.getOutcomingRequest()
    data = res_IncReq.json()
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) == 0, "The conversation list should be empty!"

    print("yann(user) gets outcoming requests\n")
    res_IncReq = yann.getOutcomingRequest()
    data = res_IncReq.json()
    assert isinstance(data, list), "Expected a list of conversations"
    assert len(data) > 0, "The conversation list is empty!"
    first_request = data[0]
    assert first_request['user']['displayName'] == "OutstandingRemy", "MegaYann should be displayed"

    print("remy(user) accepts yann(user) as friend\n")
    res_acceptFriend = remy.acceptFriend(yann)
    data = res_acceptFriend.json()
    assert data['friendship']['status'] == "ACCEPTED", "request should be accepted"
    remyFriendshipId = data['friendship']['id']

    print("remy(user, not banned) creates a conversation with yann\n")
    remy.createOrGetDirectConversation(yann)

    print("remy(user, not banned) looks at his conversations\n")
    res_my_conv = remy.getMyConversation()
    data = res_my_conv.json()
    first_conversation = data[0]
    conversation_id = first_conversation['id']

    print("remy sends message to Yann\n")
    remy.sendMessageConversation(conversation_id, "Hello Yann")

    print("renames conversation")
    res_renameConv = yann.renameConversation(conversation_id, "SuperConversation")
    data = res_renameConv.json()
    assert data['hello'] == True 

    print("remy(user) removes yann(user) as friend\n")
    res_removeFriend = remy.removeFriend(yann)
    data = res_removeFriend.json()
    assert data['removedFriendshipId'] == remyFriendshipId, "request should be accepted"

    print("remy(user) blocks yann(user) as friend\n")
    res_blockUser = remy.blockUser(yann)
    data = res_blockUser.json()
    assert data['block']['blockedId'] == yannRequesterId, "yann should be blocked"

    # full_database_audit()

    print("renames conversation")
    res_renameConv = yann.renameConversation(conversation_id, "SuperConversation")
    data = res_renameConv.json()
    assert data['hello'] == True 
    
    guillaume.eraseDataPassword()
    yann.eraseDataPassword()
    clement.eraseDataPassword()
    patsy.eraseDataPassword()
    remy.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)
    if (os.path.exists(patsy.cookies)):
        os.remove(patsy.cookies)
    if (os.path.exists(remy.cookies)):
        os.remove(remy.cookies)

test_unit1()
test_unit2()


    

    
