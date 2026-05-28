from http.cookiejar import MozillaCookieJar
import subprocess
import os
import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = 'https://localhost/api'

class User:
    def __init__(self, email: str, username: str, password: str):
        self.email = email
        self.username = username
        self.cookies = f"cookie_{username}.txt"
        self.password = password
        self.id = ''
        self.accessToken = ''
        self.role = ''
        self.message = []
        self.notification = []
        self.conversation = []


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
        
        # print(f"{self.username}: {response.json()}\n")
        # To this (temporarily):
        print(f"STATUS: {response.status_code}")
        print(f"RESPONSE BODY: {response.text}") # This will show the real error

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
            return False

        if "UPDATE 1" in result.stdout:
            print(f"{self.username}: success: true\n")
        else:
            print(f"{self.username}: success: false\n")
            print("stdout:", result.stdout)
            return False
        
        return True


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
            f"{BASE_URL}/relationships/users/{toRemove.id}/remove-friend",
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
            f"{BASE_URL}/relationships/users/{toUnblock.id}/unblock",
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


    def upload_avatar(self, filepath: str):
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

        if (response.status_code == 200 or response.status_code == 201):
            self.conversation.append(response.json()['id'])
            secondUser.conversation.append(response.json()['id'])

        print(f"{self.username}: {response.json()}\n")

        return response

    def createGroupRoom(self, title, users_ids):
        response = requests.post(
            f"{BASE_URL}/chat/group",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            json = { "title": title, "userIds": users_ids },
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response
    
    def inviteUserToGroup(self, conversation_id,  user_ids):
        response = requests.post(
            f"{BASE_URL}/chat/conversation/{conversation_id}/invite",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            json = { "userIds": user_ids },
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response

    def removeUserToGroup(self, conversation_id, user_id):
        response = requests.post(
            f"{BASE_URL}/chat/conversation/{conversation_id}/remove-user/{user_id}",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False
        )

        print(f"{self.username}: {response.json()}\n")

        return response

    def leaveConversation(self, conversation_id):
        response = requests.post(
            f"{BASE_URL}/chat/conversation/{conversation_id}/leave",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        return response

    def renameConversation(self, conversation_id, new_name):
        response = requests.patch(
            f"{BASE_URL}/chat/conversation/{conversation_id}/rename",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            json = { "title": new_name },
            verify = False,
        )

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
        if (self.conversation):
            for i in range(len(self.conversation)) :
                response = requests.get(
                    f"{BASE_URL}/chat/conversations/{self.conversation[i]}/messages",
                    headers = { "Authorization": f"Bearer {self.accessToken}" },
                    verify = False
                )

                print(f"{self.username}: {response.json()}\n")
        
            return len(self.conversation)
        return 0


    def sendMessageConversation(self, conversationId: str, message: str):
        response = requests.post(
            f"{BASE_URL}/chat/conversations/{conversationId}/messages",
            headers = { "Authorization": f"Bearer {self.accessToken}" },
            data = { "content": f"{message}" },
            verify = False,
        )

        print(f"{self.username}: {response.json()}\n")

        #if len(self.conversation) != 0:     #added a condition to avoid a difference
        #    self.message.append(message)    #between database and python list
        
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

    def reportCreationForUser(self, userTarget, reason: str):
        response = requests.post(
            f"{BASE_URL}/moderation/reports",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            json = { "targetType": userTarget.role, "targetUserId": userTarget.id, "reason": reason},
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


    def reviewReport(self, reportId: str, action: str, note: str, penaltyPoint: int):
        response = requests.patch(
            f"{BASE_URL}/moderation/reports/{reportId}/review",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            data = {"action": {action}, "note": {note}, "penaltyPointsToSubtract": {penaltyPoint}},
            verify = False,
        )
        
        print(f"{self.username}: {response.json()}\n")

        return response

    def adjustPoint(self, targetUser, note: str, penaltyPoint: int):
        response = requests.post(
            f"{BASE_URL}/moderation/users/{targetUser.id}/points",
            headers = { "Authorization": f"Bearer {self.accessToken}"},
            data = {"points": penaltyPoint, "note": note},
            verify = False
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
    
    def getPenaltyPoints(self):
    # """Retrieves the current penalty points from the backend."""
    
        response = requests.get(
            f"{BASE_URL}/users/me/points",
            headers={ "Authorization": f"Bearer {self.accessToken}" },
            verify=False
        )
        
        if response.status_code == 200:
            data = response.json()
            # points = response;

            points = data.get('penaltyPoints', 0)
            print(f"{self.username} has {points} penalty points.")
            return points
        else:
            print(f"Error fetching penalty points: {response.status_code}")
            return None