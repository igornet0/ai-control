# файл для query запросов
from typing import Tuple, Dict, Literal, Union, List, Optional
from fastapi import HTTPException
from datetime import datetime
from sqlalchemy import select, update, delete, desc, asc, Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

# Убираем циклический импорт
# from backend.api.configuration.schemas import (UserLoginResponse, UserEmailResponse)

from core.database.models import (User, Organization, Department, Permission, RolePermission)

##################### Добавляем юзера в БД #####################################

async def orm_add_user(
        session: AsyncSession,
        username: str,
        login: str,
        hashed_password: str,
        email: str | None = None,
        role: str = "employee",
        position: str | None = None,
        phone: str | None = None,
        manager_id: int | None = None,
        department_id: int | None = None,
        organization_id: int | None = None
) -> User:
    
    query = select(User).where(User.login == login)
    result = await session.execute(query)

    if result.first() is None:
        user = User(
                username=username,
                login=login,
                password_hash=hashed_password,
                email=email,
                role=role,
                position=position,
                phone=phone,
                manager_id=manager_id,
                department_id=department_id,
                organization_id=organization_id)

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user
    else:
        return result.scalars().first()
    
async def orm_get_user(session: AsyncSession, response: Union[Dict, object]) -> User | None:
    if not hasattr(response, 'login') or not response.login:
        return None
    
    query = select(User)
    
    # Проверяем, является ли это email
    if hasattr(response, 'email') and response.email:
        query = query.where(User.email == response.login)
    else:
        query = query.where(User.login == response.login)
     
    result = await session.execute(query)

    return result.scalars().first()
    
async def orm_get_user_by_login(session: AsyncSession, response) -> User | None:
    if not response.login:
        return None
    
    query = select(User).where(User.login == response.login)
     
    result = await session.execute(query)

    return result.scalars().first()

async def orm_get_user_by_email(session: AsyncSession, response) -> User | None:
    if not response.email:
        return None
    
    query = select(User).where(User.email == response.email)

    result = await session.execute(query)

    return result.scalars().first()

async def orm_get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    """Получить пользователя по ID"""
    query = select(User).where(User.id == user_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_update_user(
    session: AsyncSession, 
    user_id: int, 
    **kwargs
) -> User | None:
    """Обновить пользователя"""
    user = await orm_get_user_by_id(session, user_id)
    if not user:
        return None
    
    for key, value in kwargs.items():
        if hasattr(user, key) and value is not None:
            setattr(user, key, value)
    
    user.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(user)
    return user

async def orm_get_users_by_role(session: AsyncSession, role: str) -> List[User]:
    """Получить всех пользователей с определенной ролью"""
    query = select(User).where(User.role == role)
    result = await session.execute(query)
    return result.scalars().all()

async def orm_get_subordinates(session: AsyncSession, manager_id: int) -> List[User]:
    """Получить всех подчиненных менеджера"""
    query = select(User).where(User.manager_id == manager_id)
    result = await session.execute(query)
    return result.scalars().all()

async def orm_get_user_hierarchy(session: AsyncSession, user_id: int) -> User | None:
    """Получить пользователя с полной иерархией"""
    query = (
        select(User)
        .options(
            joinedload(User.subordinates),
            joinedload(User.manager),
            joinedload(User.department),
            joinedload(User.organization)
        )
        .where(User.id == user_id)
    )
    result = await session.execute(query)
    return result.scalars().first()

##################### Организации #####################################

async def orm_add_organization(
    session: AsyncSession,
    name: str,
    description: str | None = None,
    domain: str | None = None,
    logo_url: str | None = None,
    settings: str | None = None
) -> Organization:
    """Добавить организацию"""
    organization = Organization(
        name=name,
        description=description,
        domain=domain,
        logo_url=logo_url,
        settings=settings
    )
    session.add(organization)
    await session.commit()
    await session.refresh(organization)
    return organization

async def orm_get_organization_by_id(session: AsyncSession, org_id: int) -> Organization | None:
    """Получить организацию по ID"""
    query = select(Organization).where(Organization.id == org_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_get_organizations(session: AsyncSession) -> List[Organization]:
    """Получить все организации"""
    query = select(Organization)
    result = await session.execute(query)
    return result.scalars().all()

##################### Департаменты #####################################

async def orm_add_department(
    session: AsyncSession,
    name: str,
    organization_id: int,
    description: str | None = None,
    manager_id: int | None = None
) -> Department:
    """Добавить департамент"""
    department = Department(
        name=name,
        organization_id=organization_id,
        description=description,
        manager_id=manager_id
    )
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department

async def orm_get_department_by_id(session: AsyncSession, dept_id: int) -> Department | None:
    """Получить департамент по ID"""
    query = select(Department).where(Department.id == dept_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_get_departments_by_organization(session: AsyncSession, org_id: int) -> List[Department]:
    """Получить все департаменты организации"""
    query = select(Department).where(Department.organization_id == org_id)
    result = await session.execute(query)
    return result.scalars().all()

##################### Разрешения #####################################

async def orm_add_permission(
    session: AsyncSession,
    name: str,
    resource: str,
    action: str,
    description: str | None = None
) -> Permission:
    """Добавить разрешение"""
    permission = Permission(
        name=name,
        resource=resource,
        action=action,
        description=description
    )
    session.add(permission)
    await session.commit()
    await session.refresh(permission)
    return permission

async def orm_get_permission_by_id(session: AsyncSession, perm_id: int) -> Permission | None:
    """Получить разрешение по ID"""
    query = select(Permission).where(Permission.id == perm_id)
    result = await session.execute(query)
    return result.scalars().first()

async def orm_get_permissions_by_role(session: AsyncSession, role: str) -> List[Permission]:
    """Получить все разрешения для роли"""
    query = (
        select(Permission)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .where(RolePermission.role == role)
    )
    result = await session.execute(query)
    return result.scalars().all()

async def orm_add_role_permission(
    session: AsyncSession,
    role: str,
    permission_id: int
) -> RolePermission:
    """Добавить связь роли и разрешения"""
    role_perm = RolePermission(role=role, permission_id=permission_id)
    session.add(role_perm)
    await session.commit()
    await session.refresh(role_perm)
    return role_perm

async def orm_check_user_permission(
    session: AsyncSession,
    user_id: int,
    resource: str,
    action: str
) -> bool:
    """Проверить разрешение пользователя"""
    user = await orm_get_user_by_id(session, user_id)
    if not user:
        return False
    
    # Получаем разрешения для роли пользователя
    permissions = await orm_get_permissions_by_role(session, user.role)
    
    # Проверяем наличие нужного разрешения
    for permission in permissions:
        if permission.resource == resource and permission.action == action:
            return True
    
    return False


# ##################### Добавляем Feature в БД #####################################

# async def orm_add_feature(session: AsyncSession, feature_name: str):
#     session.add(Feature(name=feature_name))
#     await session.commit()

# async def orm_get_feature_by_name(session: AsyncSession, feature_name: str) -> Feature:
#     query = select(Feature).where(Feature.name == feature_name)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_get_feature_by_id(session: AsyncSession, feature_id: int) -> Feature:
#     query = select(Feature).where(Feature.id == feature_id)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_get_features(session: AsyncSession) -> list[Feature]:
#     query = select(Feature)
#     query = query.options(joinedload(Feature.arguments))

#     result = await session.execute(query)

#     return result.unique().scalars().all()

# async def orm_add_features_argument(session: AsyncSession, arguments: list[FeatureArgument]):
#     session.add_all(arguments)
#     await session.commit()

# async def orm_add_feature_argument(session: AsyncSession, feature_id: int, argument_name: str, type_argument: str):
#     session.add(FeatureArgument(feature_id=feature_id, 
#                                 name=argument_name,
#                                 type=type_argument))
#     await session.commit()

# async def orm_get_feature_argument(session: AsyncSession, feature_id: int) -> list[FeatureArgument]:
#     query = select(FeatureArgument).where(FeatureArgument.feature_id == feature_id)
#     result = await session.execute(query)
#     return result.scalars().all()

# ##################### Добавляем Agents и Models в БД #####################################

# async def orm_get_agent_by_name(session: AsyncSession, agent_name: str) -> Agent:
#     query = select(Agent).where(Agent.name == agent_name)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_add_agent(session: AsyncSession, agent_data: Agent):

#     if agent_data.path_model:
#         path_model = agent_data.path_model
#         if not path_model.endswith(".pth"):
#             path_model += ".pth"
#     else:
#         path_model = f"{agent_data.name}_{agent_data.version}.pth"

#     agent = Agent(
#         name = agent_data.name,
#         type = agent_data.type,
#         timeframe = agent_data.timeframe,
#         path_model = path_model,
#         a_conficent = agent_data.a_conficent,
#         active = agent_data.active,
#         version = agent_data.version)

#     session.add(agent)

#     await session.flush()

#     features = [
#             AgentFeature(
#                 agent_id = agent.id,
#                 feature_id = feature.id,
#                 feature_value = [AgentFeatureValue(value=value, feature_name=par_name) for par_name, value in feature.parameters.items()]
#         ) for feature in agent_data.features]

#     session.add_all(features)

#     await session.flush()

#     train_data = None

#     if agent_data.train_data:
#         train_data = AgentTrain(
#             agent_id = agent.id,
#             epochs = agent_data.train_data.epochs,
#             batch_size = agent_data.train_data.batch_size,
#             learning_rate = agent_data.train_data.learning_rate,
#             weight_decay = agent_data.train_data.weight_decay,
#         )

#         session.add(train_data)

#         await session.flush()

#         session.add_all([TrainCoin(train_id=train_data.id, coin_id=coin_id) for coin_id in agent_data.coins])

#     await session.commit()

#     await session.flush()

#     features_data = []

#     for feature in features:
#         parameters = {value.feature_name: value.value for value in feature.feature_value}
#         features_data.append({
#             "id": feature.id,
#             "feature_id": feature.feature_id,
#             "parameters": parameters
#         })

#     return {
#             "id": agent.id,
#             "type": agent.type,
#             "path_model": agent.path_model,
#             "active": agent.active,
#             "created": agent.created.isoformat() if agent.created else None,
#             "name": agent.name,
#             "a_conficent": agent.a_conficent,
#             "version": agent.version,
#             "updated": agent.updated.isoformat() if agent.updated else None,
#             "features": features_data
#         }, train_data


# async def orm_add_agent_feature(session: AsyncSession, agent_id: int, feature_id: int):
#     agentfeature = AgentFeature(agent_id=agent_id, feature_id=feature_id)
#     session.add(agentfeature)

#     await session.commit()

#     return agentfeature

# async def orm_get_train_agents(session: AsyncSession, status: str = None) -> list[Agent]:
#     query = select(AgentTrain)

#     if status:
#         query = query.where(AgentTrain.status == status)

#     result = await session.execute(query)

#     return result.scalars().all()

# async def orm_get_train_agent(session: AsyncSession, agent_id: int, status: str = None) -> AgentTrain:
#     query = select(AgentTrain).where(AgentTrain.agent_id == agent_id)

#     if status:
#         query = query.where(AgentTrain.status == status)

#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_add_agent_feature_value(session: AsyncSession, agent_id: int, feature_id: int, values: list):
    
#     agent_feature = AgentFeature(agent_id=agent_id, feature_id=feature_id,
#                                  feature_value=[AgentFeatureValue(value=value) for value in values])
#     # session.add(agent_feature)
#     # session.flush()
#     # feature_values = [
#     #     AgentFeatureValue(agent_feature_id=agent_feature.id, value=value)
#     #     for value in values
#     # ]

#     session.add_all(agent_feature)
#     await session.commit()

#     return agent_feature

# async def orm_get_agent_feature(session: AsyncSession, agent_id: int) -> list[AgentFeature]:
#     query = select(AgentFeature).where(AgentFeature.agent_id == agent_id)
#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_get_agents(session: AsyncSession, type_agent: str = None, 
#                          agent_id: int = None, version: str = None, 
#                          active: bool = None, query_return: bool = False,
#                          status: Literal["train", "open", "close"] = None) -> list[Agent] | Select:
#     query = select(Agent)

#     if type_agent:
#         query = query.where(Agent.type == type_agent)

#     if agent_id:
#         query = query.where(Agent.id == agent_id)

#     if version:
#         query = query.where(Agent.version == version)

#     if active:
#         query = query.where(Agent.active == active)

#     if status:
#         query = query.where(Agent.status == status)

#     if query_return:
#         return query

#     stmt = (
#         query
#         .options(
#             selectinload(Agent.features)
#             .selectinload(AgentFeature.feature_value)
#         )
#     )

#     result = await session.execute(stmt)
#     agents = result.scalars().all()
    
#     if not agents:
#         return None

#     agents_features_data = []

#     for agent in agents:
#         features_data = []

#         for feature in agent.features:
#             parameters = {value.feature_name: value.value for value in feature.feature_value}
#             feature_t = await orm_get_feature_by_id(session, feature.feature_id)
#             features_data.append({
#                 "id": feature_t.id,
#                 "name": feature_t.name,
#                 "feature_id": feature.feature_id,
#                 "parameters": parameters
#             })

#         agents_features_data.append({
#             "id": agent.id,
#             "type": agent.type,
#             "status": agent.status,
#             "timeframe": agent.timeframe,
#             "path_model": agent.path_model,
#             "active": agent.active,
#             "created": agent.created.isoformat() if agent.created else None,
#             "name": agent.name,
#             "a_conficent": agent.a_conficent,
#             "version": agent.version,
#             "updated": agent.updated.isoformat() if agent.updated else None,
#             "features": features_data
#         })

#     return agents_features_data

# async def orm_get_agents_type(session: AsyncSession) -> list[AgentType]:
#     query = select(AgentType)
#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_delete_agent(session: AsyncSession, agent_id: int):
#     agent = await session.get(Agent, agent_id)
#     if agent:
#         # Удаляем дочерние объекты
#         features = await orm_get_agent_feature(session, agent_id)
#         await session.execute(delete(AgentAction).where(AgentAction.agent_id == agent_id))
#         [await session.execute(delete(AgentFeatureValue).where(AgentFeatureValue.agent_feature_id == feature.id)) for feature in features]

#         await session.execute(delete(AgentFeature).where(AgentFeature.agent_id == agent_id))
#         await session.execute(delete(StatisticAgent).where(StatisticAgent.agent_id == agent_id))

#         trains = await orm_get_train_agent(session, agent_id)
#         [await session.execute(delete(TrainCoin).where(TrainCoin.train_id == train.id)) for train in trains]
#         await session.execute(delete(AgentTrain).where(AgentTrain.agent_id == agent_id))
        
#         # Удаляем агента
#         await session.delete(agent)
#         await session.commit()

# # async def orm_delete_agent_feature(session: AsyncSession, agent_id: int, feature_id: int):
# #     # query = delete(AgentFeature).where(AgentFeature.agent_id == agent_id, AgentFeature.feature_id == feature_id)
# #     feature = await orm_get_agent_feature_by_id(session, agent_id, feature_id)
# #     if feature:
# #         await session.execute(delete(AgentFeatureValue).where(AgentFeatureValue.agent_feature_id == feature_id))
# #         await session.delete(feature)

# #         await session.commit()

# # async def orm_delete_agent_train(session: AsyncSession, agent_id: int):
# #     train = await session.get(AgentTrain, agent_id)
# #     if train:
# #         await session.execute(delete(TrainCoin).where(TrainCoin.train_id == train.id))
# #         await session.delete(train)

# #         await session.commit()

# async def orm_get_agent_by_id(session: AsyncSession, id: int) -> Agent:
#     query = select(Agent).where(Agent.id == id)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_get_agents_options(session: AsyncSession, type_agent: str = None, 
#                          id_agent: int = None, version: str = None, 
#                          active: bool = None, mod: Literal["actions", "strategies", "stata", "all"] = None) -> list[Agent]:
#     query: Select = await orm_get_agents(session, type_agent, id_agent, version, active, query=True)
    
#     if mod in ["actions", "all"]:
#         query = query.options(joinedload(Agent.actions))

#     if mod in ["strategies", "all"]:
#         query = query.options(joinedload(Agent.strategies))

#     if mod in ["stata", "all"]:
#         query = query.options(joinedload(Agent.stata))

#     if mod in ["all"]:
#         query = query.options(joinedload(Agent.features))

#     result = await session.execute(query)

#     return result.scalars().all()

# async def orm_get_models(session: AsyncSession, type_model: str = None, 
#                          id_model: int = None, version: str = None, 
#                          query_return: bool = False) -> list[ML_Model] | Select:
#     query = select(ML_Model)

#     if type_model:
#         query = query.where(ML_Model.type == type_model)

#     if id_model:
#         query = query.where(ML_Model.id == id_model)

#     if version:
#         query = query.where(ML_Model.version == version)

#     if query_return:
#         return query
    
#     query = query.options(joinedload(ML_Model.actions), joinedload(ML_Model.stata))
#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_get_models_options(session: AsyncSession, type_model: str = None, 
#                          id_model: int = None, version: str = None, 
#                          mod: Literal["actions", "stata", "all"] = None) -> list[Agent]:
    
#     query: Select = await orm_get_models(session, type_model, id_model, version, query=True)
    
#     if mod in ["actions", "all"]:
#         query = query.options(joinedload(ML_Model.actions))

#     if mod in ["stata", "all"]:
#         query = query.options(joinedload(ML_Model.stata))

#     result = await session.execute(query)

#     return result.scalars().all()

# ##################### Добавляем монеты в БД #####################################

# async def orm_add_coin(
#         session: AsyncSession,
#         name: str,
#         price_now: float = 0
# ) -> Coin:
    
#     query = select(Coin).where(Coin.name == name)
#     result = await session.execute(query)

#     if not result.scalars().first():
#         session.add(
#             Coin(name=name,
#                  price_now=price_now)
#         )
#         await session.commit()
    
#     return await orm_get_coin_by_name(session, name)

# async def orm_get_coins(session: AsyncSession, parsed: bool = None) -> list[Coin]:
#     query = select(Coin) 

#     if parsed:
#         query = query.where(Coin.parsed == parsed)
        
#     result = await session.execute(query)

#     return result.scalars().all()

# async def orm_get_coin_by_id(session: AsyncSession, id: int, parsed: bool = None) -> Coin:
#     query = select(Coin).where(Coin.id == id)
    
#     if parsed:
#         query = query.where(Coin.parsed == parsed)

#     query = query.options(joinedload(Coin.timeseries))

#     result = await session.execute(query)
#     return result.scalar()

# async def orm_get_coin_by_name(session: AsyncSession, name: str) -> Coin:
#     query = select(Coin).where(Coin.name == name)
#     result = await session.execute(query)
#     return result.scalar()

# async def orm_update_coin_price(session: AsyncSession, name: str, price_now: float):
#     query = update(Coin).where(Coin.name == name).values(price_now=price_now)
#     await session.execute(query)
#     await session.commit()

# async def orm_add_timeseries(session: AsyncSession, coin: Coin | str, timestamp: str, path_dataset: str):
#     if isinstance(coin, str):
#         coin = await orm_get_coin_by_name(session, coin)

#     if not coin:
#         raise ValueError(f"Coin {coin} not found")
    
#     tm = await orm_get_timeseries_by_coin(session, coin, timestamp)

#     if tm:
#         return await orm_update_timeseries_path(session, tm.id, path_dataset)

#     timeseries = Timeseries(coin_id=coin.id, 
#                             timestamp=timestamp, 
#                             path_dataset=path_dataset)
#     session.add(timeseries)
#     await session.commit()

# async def orm_update_timeseries_path(session: AsyncSession, timeseries_id: int, path_dataset: str):
#     query = update(Timeseries).where(Timeseries.id == timeseries_id).values(path_dataset=path_dataset)
#     await session.execute(query)
#     await session.commit()

# async def orm_get_timeseries_by_path(session: AsyncSession, path_dataset: str):
#     query = select(Timeseries).where(Timeseries.path_dataset == path_dataset)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_get_timeseries_by_id(session: AsyncSession, id: int):
#     query = select(Timeseries).where(Timeseries.id == id)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def orm_get_timeseries_by_coin(session: AsyncSession, coin: Coin | str | int, timeframe: str = None) -> list[Timeseries] | Timeseries:
#     if isinstance(coin, str):
#         coin = await orm_get_coin_by_name(session, coin)
#     elif isinstance(coin, int):
#         coin = await orm_get_coin_by_id(session, coin)
    
#     if not coin:
#         raise ValueError(f"Coin {coin} not found")
    
#     query = select(Timeseries).options(joinedload(Timeseries.coin)).where(Timeseries.coin_id == coin.id)
        
#     if timeframe:
#         query = query.where(Timeseries.timestamp == timeframe)
    
#     result = await session.execute(query)

#     if timeframe:
#         return result.scalars().first()

#     return result.scalars().all()

# async def orm_get_data_timeseries(session: AsyncSession, timeseries_id: int) -> list[DataTimeseries]:
#     query = select(DataTimeseries).where(DataTimeseries.timeseries_id == timeseries_id)
#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_get_data_timeseries_by_datetime(session: AsyncSession, timeseries_id: int, datetime: str) -> DataTimeseries:
#     query = select(DataTimeseries).where(DataTimeseries.timeseries_id == timeseries_id, DataTimeseries.datetime == datetime)
#     result = await session.execute(query)
#     return result.scalars().first()

# async def paginate_coin_prices(
#     session: AsyncSession, 
#     coin_id: int,
#     timeframe: str = "5m",
#     last_timestamp: datetime = None, 
#     limit: int = 100,
#     sort: bool = False
# ) -> list[DataTimeseries]:
    
#     timeseries = await orm_get_timeseries_by_coin(session, coin_id, timeframe=timeframe)

#     if not timeseries:
#         raise ValueError(f"Timeseries - {timeframe} for coin - {coin_id} not found")

#     # Базовый запрос с сортировкой по времени (новые записи сначала)
#     query = select(DataTimeseries).where(DataTimeseries.timeseries_id == timeseries.id
#                                          ).order_by(desc(DataTimeseries.datetime))
    
#     # Фильтр для следующей страницы
#     if last_timestamp is not None:
#         query = query.where(DataTimeseries.datetime < last_timestamp)
    
#     # Получаем 100 записей
#     result = await session.execute(query.limit(limit))

#     records = result.scalars().all()

#     if sort:
#         return sorted(records, key=lambda x: x.datetime)

#     return records

# async def orm_add_data_timeseries(session: AsyncSession, timeseries_id: int, data_timeseries: dict):
#     dt = await orm_get_data_timeseries_by_datetime(session, timeseries_id, data_timeseries["datetime"])

#     if dt:
#         return False
    
#     session.add(DataTimeseries(timeseries_id=timeseries_id, **data_timeseries))
#     await session.commit()

#     return True


# ##################### Добавляем Portfolio в БД #####################################

# async def orm_get_coin_portfolio(session: AsyncSession, user_id: int, coin_id: int) -> Portfolio:
#     query = select(Portfolio).where(Portfolio.user_id == user_id, Portfolio.coin_id == coin_id).options(selectinload(Portfolio.coin))
#     result = await session.execute(query)

#     coin_potfolio = result.scalars().first()

#     if not coin_potfolio:
#         return None

#     return coin_potfolio

# async def orm_add_coin_portfolio(session: AsyncSession, user_id: int, coin_id: int, amount: float):
#     coin = await orm_get_coin_portfolio(session, user_id, coin_id)

#     if coin:
#         return await orm_update_amount_coin_portfolio(session, user_id, coin_id, coin[1] + amount)
    
#     session.add(Portfolio(user_id=user_id, coin_id=coin_id, amount=amount))
#     await session.commit()

# async def orm_get_coins_portfolio(session: AsyncSession, user_id: int) -> Dict[Coin, float]:
#     query = select(Portfolio).where(Portfolio.user_id == user_id).options(selectinload(Portfolio.coin))
#     result = await session.execute(query)
#     new_coins = {}
#     coins_portfolio = result.scalars().all()

#     for coin in coins_portfolio:
#         new_coins[coin.coin] = coin.amount

#     return new_coins

# async def orm_delete_coin_portfolio(session: AsyncSession, user_id: int, coin_id: int):
#     query = delete(Portfolio).where(Portfolio.user_id == user_id, Portfolio.coin_id == coin_id)
#     await session.execute(query)
#     await session.commit()

# async def orm_update_amount_coin_portfolio(session: AsyncSession, user_id: int, coin_id: int, amount: float):
#     if amount == 0:
#         return await orm_delete_coin_portfolio(session, user_id, coin_id)
    
#     query = update(Portfolio).where(Portfolio.user_id == user_id, Portfolio.coin_id == coin_id).values(amount=amount)
#     await session.execute(query)
#     await session.commit()


# ##################### Добавляем Transaction в БД #####################################

# async def orm_add_transaction(session: AsyncSession, user_id: int, coin_id: int, type_order: Literal["buy", "sell"], amount: float, price: float):
#     transaction = Transaction(user_id=user_id, 
#                               coin_id=coin_id, 
#                               type=type_order,
#                               amount=amount, 
#                               price=price)
#     session.add(transaction)
#     await session.commit()

# async def orm_get_transactions_by_id(session: AsyncSession, transaction_id: int, status: str = None) -> Transaction:
#     query = select(Transaction).where(Transaction.id == transaction_id)
#     if status:
#         if "!" in status:
#             status = status.replace("!", "")
#             query = query.where(Transaction.status != status)
#         else:
#             query = query.where(Transaction.status == status)

#     query = query.options(selectinload(Transaction.coin))
#     query = query.options(selectinload(Transaction.user))
#     result = await session.execute(query)

#     return result.scalars().first()


# async def orm_get_user_transactions(session: AsyncSession, user_id: int, status: str = None, type_order: Literal["buy", "sell"] = None) -> list[Transaction]:
#     query = select(Transaction).where(Transaction.user_id == user_id)

#     if status:
#         query = query.where(Transaction.status == status)

#     if type_order:
#         if not type_order in ["buy", "sell"]:
#             raise ValueError("type_order must be 'buy' or 'sell'")
        
#         query = query.where(Transaction.type == type_order)
        
#     result = await session.execute(query)

#     return result.scalars().all()

# async def orm_get_coin_transactions(session: AsyncSession, coin_id: int, status: str = None, type_order: Literal["buy", "sell"] = None) -> list[Transaction]:
#     query = select(Transaction).where(Transaction.coin_id == coin_id)

#     if status:
#         query = query.where(Transaction.status == status)

#     if type_order:
#         if not type_order in ["buy", "sell"]:
#             raise ValueError("type_order must be 'buy' or 'sell'")
        
#         query = query.where(Transaction.type == type_order)

#     result = await session.execute(query)
#     return result.scalars().all()

# async def orm_get_user_coin_transactions(session: AsyncSession, user_id: int, coin_id: int, status: str = None, type_order: Literal["buy", "sell"] = None) -> Dict[Coin, Dict[str, float]]:
#     query = select(Transaction).where(Transaction.user_id == user_id, Transaction.coin_id == coin_id)
    
#     if status:
#         query = query.where(Transaction.status == status)
    
#     if type_order:
#         if not type_order in ["buy", "sell"]:
#             raise ValueError("type_order must be 'buy' or 'sell'")
        
#         query = query.where(Transaction.type == type_order)

#     query = query.options(selectinload(Transaction.coin))

#     result = await session.execute(query)

#     new_coins = {}
#     coins_portfolio = result.scalars().all()

#     for coin in coins_portfolio:
#         new_coins[coin.coin] = {"id":coin.id, "amount": coin.amount, "price": coin.price}

#     return new_coins

# async def orm_update_transaction_status(session: AsyncSession, transaction_id: int, status: Literal["open", "approve", "close", "cancel"]):
#     query = select(Transaction).where(Transaction.id == transaction_id)
#     result = await session.execute(query)

#     transaction = result.scalars().first()
#     transaction.set_status(status)

#     await session.commit()

# async def orm_update_transaction_amount(session: AsyncSession, transaction_id: int, amount: float):
#     if amount == 0:
#         return await orm_update_transaction_status(session, transaction_id, status="approve")
    
#     query = update(Transaction).where(Transaction.id == transaction_id).values(amount=amount)
#     await session.execute(query)
#     await session.commit()


# async def orm_delete_transaction(session: AsyncSession, transaction_id: int):
#     query = delete(Transaction).where(Transaction.id == transaction_id)
#     await session.execute(query)
#     await session.commit()