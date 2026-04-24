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
        self.role = ''
        self.conversation = []
        self.message = []
        self.notification = []


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
            self.role = response.json()['user']['globalRole']
        
        print(f"{self.username}: {response.json()}\n")

        return response


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
            self.role = response.json()['user']['globalRole']

        session.cookies.save(ignore_discard=True, ignore_expires=True)
        print(f"{self.username}: {response.json()}\n")

        return response


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

        return response


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

        return response


    def promoteAdmin(self):
        safe_email = self.email.replace("'", "''")
        sql = f'UPDATE "User" SET "globalRole" = \'ADMIN\' WHERE "email" = \'{safe_email}\';'

        result = subprocess.run(
            [
                "docker", "compose", "exec", "-T",
                "postgres",
                "sh", "-lc",
                'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
            ],
            input=sql,
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"{self.username}: success: false")
            print("stderr:", result.stderr)
            return

        if "UPDATE 1" in result.stdout:
            print(f"{self.username}: success: true\n")
        else:
            print(f"{self.username}: success: false\n")
            print("stdout:", result.stdout)
        
        return result


    def eraseDataPassword(self):
        response = requests.post(
            f"{BASE_URL}/users/me/erase-data",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            json = { "currentPassword": self.password },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def banUser(self, userToBan):
        response = requests.post(
            f"{BASE_URL}/admin/users/{userToBan.id}/ban",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def unbanUser(self, userToUnban):
        response = requests.post(
            f"{BASE_URL}/admin/users/{userToUnban.id}/unban",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def promoteUserToModerator(self, userToPromote):
        response = requests.post(
            f"{BASE_URL}/admin/users/{userToPromote.id}/promote",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def unPromoteModeratorToUser(self, moderatorToUnpromote):
        response = requests.post(
            f"{BASE_URL}/admin/users/{moderatorToUnpromote.id}/unpromote",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response



    def sendFriendRequest(self, toSend):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{toSend.id}/friend-request",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def acceptFriend(self, userAccepted):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{userAccepted.id}/friend-accept",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def removeFriend(self, toRemove):
        response = requests.delete(
            f"{BASE_URL}/relationships/users/{toRemove.id}/friend",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def blockUser(self, toBlock):
        response = requests.post(
            f"{BASE_URL}/relationships/users/{toBlock.id}/block",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def unblockUser(self, toUnblock):
        response = requests.delete(
            f"{BASE_URL}/relationships/users/{toUnblock.id}/block",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def searchUser(self, userToSearch):
        response = requests.get(
            f"{BASE_URL}/users/search?q={userToSearch.username}",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def getMyFriends(self):
        response = requests.get(
            f"{BASE_URL}/users/friends",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def getIncomingRequest(self):
        response = requests.get(
            f"{BASE_URL}/relationships/requests/incoming",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def getOutcomingRequest(self):
        response = requests.get(
            f"{BASE_URL}/relationships/requests/outgoing",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def updateProfile(self, profile):
        response = requests.patch(
            f"{BASE_URL}/users/update/profile",
            json = profile,
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def upload_avatar(self, filepath):
        with open(filepath, "rb") as f:
            response = requests.patch(
            f"{BASE_URL}/users/update/avatar",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            files={"file": ("avatar.png", f, "image/png")},
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def createOrGetDirectConversation(self, secondUser):
        response = requests.post(
            f"{BASE_URL}/chat/direct/{secondUser.id}",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )
        self.conversation.append(response.json()['id'])
        secondUser.conversation.append(response.json()['id'])

        print(f"{self.username}: {response.json()}\n")

        return response


    def getMyConversation(self):
        response = requests.get(
            f"{BASE_URL}/chat/conversations",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def getMessageConversation(self):
        for i in range(len(self.conversation)) :
            response = requests.get(
                f"{BASE_URL}/chat/conversations/{self.conversation[i]}/messages",
                headers = { "Authorization": f"Bearer {self.accessToken}" },
                verify = False
            )

            print(f"{self.username}: {response.json()}\n")

        return response

    def sendMessageConversation(self, message: str):
        for i in range(len(self.conversation)) :
            response = requests.post(
                f"{BASE_URL}/chat/conversations/{self.conversation[i]}/messages",
                headers = { "Authorization": f"Bearer {self.accessToken}" },
                data = { "content": f"{message}" },
                verify = False,
            )

            print(f"{self.username}: {response.json()}\n")
        self.message.append(message)

        return response
        
    def getMyNotifications(self):
        response = requests.get(
            f"{BASE_URL}/motifications",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response
    
    def markOneNotificationsAsRead(self):
        response = requests.patch(
            f"{BASE_URL}/notifications/{self.notification[0]}/read",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response

    def markAllNotificationsAsRead(self):
        response = requests.patch(
            f"{BASE_URL}/notifications/read-all",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response

    def reportCreationForUser(self, userTarget):
        response = requests.post(
            f"{BASE_URL}/moderation/reports",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            json = { "targetType": userTarget.role, "targetUserId": userTarget.id, "reason": "spam and abusive content"},
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def reportCreationForMessage(self, userTarget):
        response = requests.post(
            f"{BASE_URL}/moderation/reports",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            json = { "targetType": "MESSAGE", "targetMessageId": userTarget.message[0], "reason": "abusive content"},
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def listReport(self):
        response = requests.get(
            f"{BASE_URL}/moderation/reports",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response


    def reviewReport(self, action, note):
        response = requests.get(
            f"{BASE_URL}/moderation/reports",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            json = {"action": {action}, "note": {note}},
            verify = False,
        )
        
        print(f"{self.username}: {response.json()}\n")

        return response


    def getMe(self):
        response = requests.get(
            f"{BASE_URL}/users/me",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response