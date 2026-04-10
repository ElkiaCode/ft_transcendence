from users import *

def testUnit():
    guillaume   = User("guillaume.roustan1@gmail.com", "laGuigue06", "pass1234")
    yann        = User("yann@gmail.com", "MegaYann", "pass1234")
    clement     = User("clem@gmail.com", "SuperClem", "pass1234")


    print(f"Creation of user: guillaume, yann, clement...\n")

    print("guillaume is registering into the app:\n")
    guillaume.register()
    print("yann is registering into the app:\n")
    yann.register()
    print("clement is registering into the app:\n")
    clement.register()


    print("guillaume is logging into the app:\n")
    guillaume.login()
    print("yann is logging into the app:\n")
    yann.login()
    print("clement is logging into the app:\n")
    clement.login()

    print("guillaume refresh his cookie:\n")
    guillaume.refreshCookie()
    print("yann refresh his cookie:\n")
    yann.refreshCookie()
    print("clement refresh his cookie:\n")
    clement.refreshCookie()

    print("guillaume promote himself to admin:\n")
    guillaume.promoteAdmin()

    print("guillaume logout:\n")
    guillaume.logout()
    print("yann logout:\n")
    yann.logout()
    print("clement logout:\n")
    clement.logout()

    print("guillaume loggin back in:\n")
    guillaume.login()
    print("yann loggin back in:\n")
    yann.login()
    print("clement loggin back in:\n")
    clement.login()

    print("guillaume get himself:\n")
    guillaume.getMe()
    print("yann get himself:\n")
    yann.getMe()
    print("clement get himself:\n")
    clement.getMe()

    print("guillaume ban yann:\n")
    guillaume.banUser(yann)

    print("yann try to loggin\n")
    yann.login()

    print("guillaume unban yann\n")
    guillaume.unbanUser(yann)

    print("yann retry to loggin\n")
    yann.login()

    print("guillaume erase his data:\n")
    guillaume.eraseDataPassword()
    print("yann erase his data:\n")
    yann.eraseDataPassword()
    print("clement erase his data:\n")
    clement.eraseDataPassword()

    if (os.path.exists(guillaume.cookies)):
        os.remove(guillaume.cookies)
    if (os.path.exists(yann.cookies)):
        os.remove(yann.cookies)
    if (os.path.exists(clement.cookies)):
        os.remove(clement.cookies)

testUnit()