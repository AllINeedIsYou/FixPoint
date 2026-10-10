from fastapi import APIRouter

from src.api.roles.engineer import router_eng
from src.api.roles.operator import router_operator
from src.api.roles.admin import router_admin
from src.api.roles.repairer import router_repair
from src.api.roles.client import router_client
from src.auth.auth import router_auth


router=APIRouter() #главный папа роутер
#детки-пиздюки
router.include_router(router_eng) #инженер
router.include_router(router_operator)#оператор
router.include_router(router_admin)#админ
router.include_router(router_repair)#работяга-трудяга
router.include_router(router_client)# наш любимый, ценный пользователь
router.include_router(router_auth) # авторизация