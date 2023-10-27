# Angular Starter Project

This project is a starter project for using remult & angular that already has a menu, basic user management and other utilities.

To use in a new project:
```sh
npx degit noam-honig/angular-starter-project.git my-project
cd my-project
npm i
```

To run:
```sh
npm run dev
```

# Tutorial:
See [Creating a Fullstack Angular Remult app for non web developer](https://github.com/noam-honig/angular-starter-project/wiki/Creating-a-Fullstack-Angular-Remult-app-for-non-web-developer)


# Create an Heroku site and deploy to it
```sh
heroku apps:create 
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set SESSION_SECRET=some-very-secret-key
git push heroku master 
heroku apps:open
```

![image](https://github.com/noam-honig/trempim/assets/16635859/dc6ee3e8-0ae6-4237-a27c-36aff2e0c9bf)
