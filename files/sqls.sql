SELECT --count(*),
org,taskid, createdat,session,createuserid,eventstatus,driverid,
       CASE
           WHEN what like 'טלפון 0%' THEN 'טלפון לא מוכר'
           ELSE what
       END AS thewhat,
       CASE
           WHEN what ='צפייה'
                OR what='סינון' THEN notes
           WHEN what = 'שגיאה' THEN CASE
                                        WHEN notes like 'טלפון 0%' THEN 'טלפון לא מוכר'
                                        WHEN notes like 'הקוד הוא%' THEN 'הקוד הוא'
										WHEN notes like 'נסיעה נעולה%' THEN 'נסיעה נעולה'
										WHEN notes like 'מספר טלפון לא מוכר%' THEN 'מספר טלפון לא מוכר'
                                        ELSE notes
                                    END
           ELSE ''
       END AS thenotes
from 
(
select  org,taskid, what,notes,createdat,session,createuserid,eventstatus,driverid  from  shinuim.taskstatuschanges union all
select  org,taskid, what,notes,createdat,session,createuserid,eventstatus,driverid  from  vdri.   taskstatuschanges    union all
select  org,taskid, what,notes,createdat,session,createuserid,eventstatus,driverid  from  ezion.  taskstatuschanges   union all
select  org,taskid, what,notes,createdat,session,createuserid,eventstatus,driverid  from  civil.  taskstatuschanges   union all
select  org,taskid, what,notes,createdat,session,createuserid,eventstatus,driverid  from  wrc.    taskstatuschanges 
) as ts
--group by thewhat ,thenotes
--order by 1 desc




SELECT id,
       org,
       taskstatus,
       category,
       eventdate,
       starttime,
       addressApiResult->>'district' AS from_district,
       addressApiResult->>'branch' AS from_branch,
	   toaddressapiresult->>'district' AS to_district,
       toaddressapiresult->>'branch' AS to_branch,
       distance,
       createdat,
       imageid
FROM (
select id,org,taskstatus,category,eventdate,starttime,addressapiresult,toaddressapiresult,distance,createdat,imageid from shinuim.tasks union all
select id,org,taskstatus,category,eventdate,starttime,addressapiresult,toaddressapiresult,distance,createdat,imageid from vdri.   tasks union all
select id,org,taskstatus,category,eventdate,starttime,addressapiresult,toaddressapiresult,distance,createdat,imageid from ezion.  tasks union all
select id,org,taskstatus,category,eventdate,starttime,addressapiresult,toaddressapiresult,distance,createdat,imageid from civil.  tasks union all
select id,org,taskstatus,category,eventdate,starttime,addressapiresult,toaddressapiresult,distance,createdat,imageid from wrc.    tasks union all
)
as t





SELECT id,md5(phone) phone,org,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted
FROM (
select id,org,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted from shinuim.users union all
select id,org,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted from vdri.   users union all
select id,org,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted from ezion.  users union all
select id,org,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted from civil.  users union all
select id,org,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted from wrc.    users 
)
as t



with all_users as  (
select id,org,name,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted,(select count(*) from shinuim.tasks where driverid=users.id) trips from shinuim.users union all
select id,org,name,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted,(select count(*) from vdri   .tasks where driverid=users.id) trips from vdri.   users union all
select id,org,name,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted,(select count(*) from ezion  .tasks where driverid=users.id) trips from ezion.  users union all
select id,org,name,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted,(select count(*) from civil  .tasks where driverid=users.id) trips from civil.  users union all
select id,org,name,phone,createdate,createuserid,admin,dispatcher,trainee,managedrivers,deleted,(select count(*) from wrc    .tasks where driverid=users.id) trips from wrc.    users 
)
,
 users_by_phones as (
SELECT phone,count(*),sum(trips),string_agg(org,',') as orgs,string_agg(name,',')
FROM all_users
as t

group by phone
	
having  sum(trips) >0 )

select  * from users_by_phones
--where orgs != 'lev1,ngim'


truncate table mgln.tasks;
truncate table mgln.changeLog;
truncate table mgln.taskStatusChanges;
truncate table mgln.images;
truncate table mgln.session;
truncate table mgln.users;



insert into mgln.tasks  (id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId)
select id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId
from ezion.tasks;

insert into mgln.changeLog (id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields)
select id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields
from ezion.changeLog;

insert into mgln.taskStatusChanges (id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt)
select id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt
from ezion.taskStatusChanges;

insert into mgln.images (id, image, createdAt, createUser)
select id, image, createdAt, createUser
from ezion.images;

insert into mgln.session (id, createdAt, ip, headers)
select id, createdAt, ip, headers
from ezion.session;

insert into mgln.users (id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories)
select id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories
from ezion.Users;







insert into mgln.tasks  (id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId)
select id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId
from wrc.tasks;

insert into mgln.changeLog (id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields)
select id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields
from wrc.changeLog;

insert into mgln.taskStatusChanges (id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt)
select id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt
from wrc.taskStatusChanges;

insert into mgln.images (id, image, createdAt, createUser)
select id, image, createdAt, createUser
from wrc.images;

insert into mgln.session (id, createdAt, ip, headers)
select id, createdAt, ip, headers
from wrc.session;

insert into mgln.users (id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories)
select id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories
from wrc.Users;




insert into mgln.tasks  (id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId)
select id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId
from civil.tasks;

insert into mgln.changeLog (id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields)
select id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields
from civil.changeLog;

insert into mgln.taskStatusChanges (id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt)
select id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt
from civil.taskStatusChanges;

insert into mgln.images (id, image, createdAt, createUser)
select id, image, createdAt, createUser
from civil.images;

insert into mgln.session (id, createdAt, ip, headers)
select id, createdAt, ip, headers
from civil.session;

insert into mgln.users (id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories)
select id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories
from civil.Users;



insert into mgln.tasks  (id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId)
select id, org, title, taskStatus, statusChangeDate, description, urgency, category, eventDate, startTime, relevantHours, validUntil, addressApiResult, address, toAddressApiResult, toAddress, distance, requesterPhone1, requesterPhone1Description, phone1, phone1Description, phone2, phone2Description, toPhone1, tpPhone1Description, toPhone2, tpPhone2Description, privateDriverNotes, createdAt, createUserId, driverId, statusNotes, externalId, internalComments, imageId, returnMondayStatus, editLink, publicVisibleBoolean, responsibleDispatcherId
from vdri.tasks;

insert into mgln.changeLog (id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields)
select id, org, relatedId, relatedName, entity, appUrl, apiUrl, changeDate, userId, userName, changes, changedFields
from vdri.changeLog;

insert into mgln.taskStatusChanges (id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt)
select id, org, taskId, what, eventStatus, notes, driverId, createUserId, session, createdAt
from vdri.taskStatusChanges;

insert into mgln.images (id, image, createdAt, createUser)
select id, image, createdAt, createUser
from vdri.images;

insert into mgln.session (id, createdAt, ip, headers)
select id, createdAt, ip, headers
from vdri.session;

insert into mgln.users (id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories)
select id, org, name, phone, adminNotes, createDate, createUserId, admin, dispatcher, trainee, manageDrivers, deleted, lastUpdateView, addressApiResult, address, showAllOrgs, okCategories
from vdri.Users;