from users import *
from database import *


def test_unit():
    print(f"Creation of user: guillaume, yann, clement...\n")
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")

    print("guillaume se register\n")
    guillaume.register()
    print("yann se register\n")
    yann.register()
    print("clement se register\n")
    clement.register()

    #users_id = []
    #conversation_id = ""
#
    #print("guillaume se login\n")
    #guillaume.login()
    #print("yann se login\n")
    #users_id.append(yann.login().json()['user']['id'])
    #print("clement se login\n")
    #users_id.append(clement.login().json()['user']['id'])
#
    #print("guillaume cree un groupe avec yann et clement\n")
    #conversation_id = guillaume.createGroupRoom("groupe de guigui", users_id).json()['conversation']['id']
#
    #print("guillaume envoie un message dans le groupe cree\n")
    #guillaume.sendMessageConversation(conversation_id, "salut c'est guillaume")
#
    #print("guillaume promote himself to admin\n")
    #guillaume.promoteAdmin()
    #guillaume.refreshCookie()
#
    #print('guillaume report clement\n')
    #report_id = guillaume.reportCreationForUser(clement, "spam group").json()['id']
#
    #print("guillaume review the report\n")
    #guillaume.reviewReport(report_id, "WARN", "be carefull", 600)
    #print("guillaume donne des points a clement\n")
    #guillaume.adjustPoint(clement, "test", 100)

    full_database_audit()

    print("guillaume erases all his data\n")
    guillaume.eraseDataPassword()
    print("clement erases all his data\n")
    clement.eraseDataPassword()
    print("yann erases all his data\n")
    yann.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)
    
test_unit()