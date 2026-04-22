from users import *
from database import *

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

    #print("guillaume cree un channel de discution direct entre lui et yann\n")
    #guillaume.createOrGetDirectConversation(yann)
    #print("guillaume cree un channel de discution direct avec clement\n")
    #guillaume.createOrGetDirectConversation(clement)

    #print("guillaume regarde toute ces conversation actives\n")
    #guillaume.getMyConversation()

    #print("guillaume envoie un message a yann\n")
    #guillaume.sendMessageConversation("test")
#
    #print("guillaume regarde tout les message de toute ces conversations\n")
    #guillaume.getMessageConversation()

    full_database_audit()

    #print("guillaume erase his data\n")
    #guillaume.eraseDataPassword()
    #print("yann erase his data\n")
    #yann.eraseDataPassword()
    print("clement erase his data\n")
    clement.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)

testUnit()