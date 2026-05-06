from users import *
from database import *
import time

def test_unit():
    print(f"Creation of user: guillaume, yann, clement...\n")
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    toto        = User("toto@gmail.com", "toto", "totototo")  

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
    print("toto is registering into the app:\n")
    toto.register()

    print("guillaume is loging:\n")
    res_login = guillaume.login()
    data = res_login.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['username'] == "laGuigue06"
    print("yann is loging:\n")
    yann.login()
    print("clement is loging:\n")
    clement.login()
    print("toto is loging:\n")
    toto.login()  

    print("guillaume(user) tries to look at report\n")
    res_report_fail = guillaume.listReport()
    assert res_report_fail.status_code == 403, "Expected 403 for insufficient role"

    print("Guillaume(user, not banned) looks at his conversations\n")
    guillaume.getMyConversation()
    res_my_conv = guillaume.getMyConversation()
    data = res_my_conv.json()
    assert data == [], "data should be empty as no conversations have been created"

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

    print("guillaume(user, not banned) sends a message to Yann\n")
    res_sendMessage = guillaume.sendMessageConversation("salut yann!")
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

    print("Guillaume as admin promotes toto as moderator\n")
    res_promoteModeratorSuccess = guillaume.promoteUserToModerator(toto)
    data = res_promoteModeratorSuccess.json()
    assert "user" in data, "SQL Update failed to promote user to Moderator"
    assert data['user']['globalRole'] == "MODERATOR", "globalRole not updated to moderator"
    res_refreshCookie = toto.refreshCookie()
    data = res_refreshCookie.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['globalRole'] == "MODERATOR"

    print("Toto(moderator) bans Clement(user)\n")
    res_banSuccess = toto.banUser(clement)
    data = res_banSuccess.json()
    assert "user" in data, "user missing"
    assert data['user']['isBanned'] == True, "Clement should be banned!"

    print("Guillaume(admin) tries to promote clement(user, banned) as moderator\n")
    res_promoteModFail = guillaume.promoteUserToModerator(clement)
    data = res_promoteModFail.json()
    assert data['statusCode']  == 400, "Clement should not be promoted to moderator"

    print("toto (moderator) tries to promote clement(user, banned) to moderator\n")
    res_promoteModFail = toto.promoteUserToModerator(clement)  
    data = res_promoteModFail.json()
    assert data['statusCode']  == 403, "Clement should not be promoted to moderator"

    print("Guillaume as admin tries to unpromote clement(user, banned) to user\n")
    res_unpromoteModFail = guillaume.unPromoteModeratorToUser(clement)
    data = res_unpromoteModFail.json()
    assert data['statusCode'] == 400, "Clement should not be unpromoted to user"

    print("Clement (user, banned) tries to promote yann as moderator\n")
    res_promoteModFail = clement.promoteUserToModerator(yann)
    data = res_promoteModFail.json()
    assert data['statusCode'] == 401, "Clement should not be promoted to moderator"

    print("yann(user) tries to unban clement(user, banned)\n")
    res_unbanFail = yann.unbanUser(clement)
    data = res_unbanFail.json()
    assert data['statusCode'] == 403, "Yann should not unban another user"

    print("toto(moderator) unbans clement(user, banned)\n")
    res_unbanTrue = toto.unbanUser(clement)
    data = res_unbanTrue.json()
    assert "user" in data, "toto as moderator should be able to unban clement"
    assert data['user']['isBanned'] == False

    # Crée un user admin
    patsy = User("patsy@test.com", "patsy", "pass1234")
    patsy.register()
    patsy.login()
    patsy.promoteAdmin()
    patsy.refreshCookie()  

    print("Guillaume as admin unpromotes toto(moderator) to user\n")
    res_unpromoteModSuccess = guillaume.unPromoteModeratorToUser(toto)
    data = res_unpromoteModSuccess.json()
    assert "user" in data, "Guillaume as admin should be able to unpromote a moderator"
    assert data['user']['globalRole'] == "USER"
    res_refreshCookie = toto.refreshCookie()
    data = res_refreshCookie.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['globalRole'] == "USER"

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

    print("toto erases all his data\n")
    toto.eraseDataPassword()

    print("patsy erases all his data\n")
    patsy.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)
    if (os.path.exists(toto.cookies)):
        os.remove(toto.cookies)
    if (os.path.exists(patsy.cookies)):
        os.remove(patsy.cookies)

test_unit()

