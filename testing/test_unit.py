from users import *
from database import *

def testUnit():
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")
    toto        = User("toto@gmail.com", "toto", "totototo")


    print(f"Creation of user: guillaume, yann, clement, toto...\n")

    print("guillaume is registering into the app:\n")
    guillaume.register()
    print("yann is registering into the app:\n")
    yann.register()
    print("clement is registering into the app:\n")
    clement.register()
    print("toto is registering into the app:\n")
    toto.register()


    # print("guillaume is logging into the app:\n")
    guillaume.login()
    # print("yann is logging into the app:\n")
    yann.login()
    # print("clement is logging into the app:\n")
    clement.login()
    toto.login()

    # print("guillaume refresh his cookie:\n")
    guillaume.refreshCookie()
    # print("yann refresh his cookie:\n")
    yann.refreshCookie()
    # print("clement refresh his cookie:\n")
    clement.refreshCookie()

    # print("guillaume promote himself to admin:\n")
    # guillaume.promoteAdmin()

    # print("guillaume logout:\n")
    # guillaume.logout()
    # print("yann logout:\n")
    # yann.logout()
    # print("clement logout:\n")
    # clement.logout()

    # print("guillaume loggin back in:\n")
    # guillaume.login()
    # print("yann loggin back in:\n")
    # yann.login()
    # print("clement loggin back in:\n")
    # clement.login()

    # print("guillaume get himself:\n")
    # guillaume.getMe()
    # print("yann get himself:\n")
    # yann.getMe()
    # print("clement get himself:\n")
    # clement.getMe()

    # print("guillaume ban yann:\n")
    # guillaume.banUser(yann)

    # print("guillaume try to unban clement even tho he is not ban:\n")
    # guillaume.unbanUser(clement)

    # print("yann try to loggin\n")
    # yann.login()

    # print("guillaume unban yann\n")
    # guillaume.unbanUser(yann)

    # print("yann retry to loggin\n")
    # yann.login()

    # print("guillaume send a friend request to yann\n")
    guillaume.sendFriendRequest(toto)
    yann.sendFriendRequest(toto)
    clement.sendFriendRequest(toto)

    # print("yann accept guillaume friend request\n")
    # yann.acceptFriend(guillaume)

    # print("yann don't like guillaume anymore and block him\n")
    # yann.blockUser(guillaume)

    # print("guillaume also block yann\n")
    # guillaume.blockUser(yann)

    # print("guillaume try to unbloc the relationship himself\n")
    # guillaume.unblockUser(yann)

    # print("yann found redemption inside the heart of guillaume and decide to unblock him\n")
    # yann.unblockUser(guillaume)

    # print("guillaume send a friend request to clement\n")
    # guillaume.sendFriendRequest(clement)

    # check_friendships()

    # print("clement accept the friend request\n")
    # clement.acceptFriend(guillaume)

    # print("yann envoie une demande d'amis a guillaume\n")
    # yann.sendFriendRequest(guillaume)

    # print("yann regarde ses requete d'amis pending\n")
    # yann.getOutcomingRequest()

    # print("guillaume regarde ses demande d'amis\n")
    # guillaume.getOutcomingRequest()

    # print("guillaume regarde ses amis\n")
    # guillaume.getMyFriends()

    # check_friendships()
    # check_database_user()

    # print("guillaume is searching the user clement\n")
    # guillaume.searchUser(clement)

    # print("guillaume erase his data:\n")
    # guillaume.eraseDataPassword()
    # print("yann erase his data:\n")
    # yann.eraseDataPassword()
    # print("clement erase his data:\n")
    # clement.eraseDataPassword()

    full_database_audit()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)

testUnit()