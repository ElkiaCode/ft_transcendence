from http.cookiejar import MozillaCookieJar
import subprocess
import os
import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = 'https://localhost/api'

class User:
    def __init__(self, email, username, password):
        self.email = email
        self.username = username
        self.cookies = f"cookie_{username}.txt"
        self.password = password
        self.id = ''
        self.accessToken = ''

    def register(self):
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json = {
                "email": self.email,
                "username": self.username,
                "password": self.password
            },
            verify = False
        )

        if (response.status_code == 200 or response.status_code == 201):
            self.accessToken = response.json()['accessToken']
            self.id = response.json()['user']['id']
        
        print(f"{self.username}: {response.json()}\n")

    def login(self):
        session = requests.Session()
        session.cookies = MozillaCookieJar(self.cookies)

        if os.path.exists(self.cookies):
            session.cookies.load(ignore_discard=True, ignore_expires=True)

        response = session.post(
            f"{BASE_URL}/auth/login",
            json = {
                "email": self.email,
                "password": self.password
            },
            verify = False 
        )

        if (response.status_code == 200 or response.status_code == 201):
            self.accessToken = response.json()['accessToken']
            self.id = response.json()['user']['id']

        session.cookies.save(ignore_discard=True, ignore_expires=True)
        print(f"{self.username}: {response.json()}\n")

    def logout(self):
        session = requests.Session()
        session.cookies = MozillaCookieJar(self.cookies)

        if os.path.exists(self.cookies):
            session.cookies.load(ignore_discard=True, ignore_expires=True)

        response = session.post (
            f"{BASE_URL}/auth/logout",
            verify = False
        )

        session.cookies.save(ignore_discard=True, ignore_expires=True)
        print(f"{self.username}: {response.json()}\n")

    def refreshCookie(self):
        session = requests.Session()
        session.cookies = MozillaCookieJar(self.cookies)

        if os.path.exists(self.cookies):
            session.cookies.load(ignore_discard=True, ignore_expires=True)

        response = session.post (
            f"{BASE_URL}/auth/refresh",
            verify = False
        )

        if (response.status_code == 200 or response.status_code == 201):
            self.accessToken = response.json()['accessToken']

        session.cookies.save(ignore_discard=True, ignore_expires=True)
        print(f"{self.username}: {response.json()}\n")

    def promoteAdmin(self):
        safe_email = self.email.replace("'", "''")
        sql = f'UPDATE "User" SET "globalRole" = \'ADMIN\' WHERE email = \'{safe_email}\';'

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
        if (result.returncode == 1):
            print(f"{self.username}: success: false\n")
            return
        
        print(f"{self.username}: success: false\n")

    def eraseDataPassword(self):
        response = requests.post(
            f"{BASE_URL}/users/me/erase-data",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            json = { "currentPassword": self.password },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")


    def banUser(self, userToBan):
        response = requests.post(
            f"{BASE_URL}/admin/users/{userToBan.id}/ban",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def unbanUser(self, userToUnban):
        response = requests.post(
            f"{BASE_URL}/admin/users/{userToUnban.id}/unban",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def sendFriendRequest(self, toSend):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{toSend.id}/friend-request",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def acceptFriend(self, userAccepted):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{userAccepted.id}/friend-accept",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def removeFriend(self, toRemove):
        response = requests.delete(
            f"{BASE_URL}/relationships/users/{toRemove.id}/friend",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def blockUser(self, toBlock):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{toBlock.id}/block",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def unblockUser(self, toUnblock):
        response = requests.delete(
            f"{BASE_URL}/relationships/users/{toUnblock.id}/block",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def searchUser(self, userToSearch):
        response = requests.get(
            f"{BASE_URL}/users/search?q={userToSearch.username}",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

    def getMe(self):
        response = requests.get(
            f"{BASE_URL}/users/me",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")