from users import *
from database import *
import time

def testUnit():
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    toto        = User("toto@gmail.com", "toto", "totototo")

    print(f"Creation of user: guillaume, yann, clement...\n")

    print("guillaume se register\n")
    guillaume.register()
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

    print("Guillaume cree une converrsation avec yann\n")
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

    print("guillaume promote to admin\n")
    guillaume.promoteAdmin()

    check_user_by_email(guillaume.email)

    print("guillaume regarde les report avec les droit necessaire\n")
    guillaume.listReport()

    #print("guillaume efface toute ses donnees\n")
    #guillaume.eraseDataPassword()
    print("yann efface toute ses donnees\n")
    yann.eraseDataPassword()
    print("clement efface toute ses donnees\n")
    clement.eraseDataPassword()

    full_database_audit()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)

testUnit()