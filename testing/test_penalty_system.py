from users import *
import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

#to run this test, database must be empty!
# class Test:
def test_penalty_system():
    guillaume = User("guillaume@gmail.com", "laGuigue06", "pass1234")
    patsy = User("patsy@gmail.com", "patsy", "pass1234")
    guillaume.register()
    patsy.register()
    guillaume.login()
    patsy.login()

    guillaume.createOrGetDirectConversation(patsy)
    res_conv = guillaume.getMyConversation()
    data = res_conv.json()
    first_conversation = data[0]
    conversation_id = first_conversation['id']

    # guillaume.getMe()
    # Get initial points
    initial_points = guillaume.getPenaltyPoints()

    guillaume.sendMessageConversation(conversation_id, "merde")   

    # Get points again
    new_points = guillaume.getPenaltyPoints()
    
    assert new_points < initial_points, "Penalty points should have decreased as 'merde' considered as an insult!"


test_penalty_system()