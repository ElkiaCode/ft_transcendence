from users import *
from database import *
import time

def test_unit():
    print(f"Creation of user: guillaume, yann, clement...\n")
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    toto        = User("toto@gmail.com", "toto", "totototo")  

    print("guillaume se register\n")
    res_g = guillaume.register()
    data = res_g.json()
    assert "accessToken" in data, "Response did not contain an accessToken"
    assert data['user']['username'] == "laGuigue06"
    print("✅ Success: User registered and token received.")

    print("guillaume registers a second time\n")
    res_duplicate = guillaume.register()
    print("\nTesting duplicate registration...")
        
    # ASSERT: Check if it correctly fails with 400
    assert res_duplicate.status_code == 400, "Expected 400 for duplicate email"
    assert res_duplicate.json()['message'] == "email already in use"
    print("✅ Success: System correctly blocked duplicate email.")

    
    
    print("yann se register\n")
    yann.register()
    print("clement se register\n")
    clement.register()
    print("toto is registering into the app:\n")
    toto.register()

    print("guillaume se login\n")
    guillaume.login()
    print("yann se login\n")
    yann.login()
    print("clement se login\n")
    clement.login()
    print("toto se login\n")
    toto.login()  

    print("guillaume regarde les report avec les droit necessaire\n")
    guillaume.listReport()

    print("Guillaume as admin promotes toto as moderator\n")
    guillaume.promoteUserToModerator(toto)

    print("Guillaume cree une conversation avec yann\n")
    guillaume.createOrGetDirectConversation(yann)

    print("Guillaume regarde toute ces conversation\n")
    guillaume.getMyConversation()

    print("guillaume envoie un message a la conversation entre lui et yann\n")
    guillaume.sendMessageConversation("salut yann!")

    print("Guillaume regarde de ses message de ses conversation\n")
    guillaume.getMessageConversation()

    print("guillaume report yann\n")
    guillaume.reportCreationForUser(yann)

    print("guillaume regarde tous les report mais n'a pas les droit\n")
    guillaume.listReport()

    print("guillaume promoted to admin\n")
    guillaume.promoteAdmin()
    guillaume.refreshCookie()
    
    print("guillaume regarde les report avec les droit necessaire\n")
    guillaume.listReport()

    print("Guillaume as admin promotes toto as moderator\n")
    guillaume.promoteUserToModerator(toto)
    toto.refreshCookie()

    print("Toto(moderator) bans Clement(toto.refreshCookie()user)\n")
    toto.banUser(clement)

    print("Guillaume as admin tries to promote clement(user, banned) as moderator\n")
    guillaume.promoteUserToModerator(clement)

    print("toto (moderator) tries to promote clement(user, banned) to moderator\n")
    toto.promoteUserToModerator(clement)  

    print("Guillaume as admin tries to unpromote clement(user, banned) to user\n")
    guillaume.unPromoteModeratorToUser(clement)

    print("Clement (user, banned) tries to promote yann as moderator\n")
    clement.promoteUserToModerator(yann)

    print("yann(user) tries to unban clement(user, banned)\n")
    yann.unbanUser(clement)

    print("toto(moderator) unbans clement(user, banned)\n")
    toto.unbanUser(clement)
    
    print("Guillaume as admin unpromotes toto(moderator) to user\n")
    guillaume.unPromoteModeratorToUser(toto)
    toto.refreshCookie()  

    print("guillaume efface toutes ses donnees\n")
    guillaume.eraseDataPassword()
    print("yann efface toutes ses donnees\n")
    yann.eraseDataPassword()
    print("clement efface toutes ses donnees\n")
    clement.eraseDataPassword()
    print("toto efface toutes ses donnees\n")
    toto.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)
    if (os.path.exists(toto.cookies)):
        os.remove(toto.cookies)

# test_unit()

