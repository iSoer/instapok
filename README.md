# Getting started

Docker is preferred for local project development

To install using docker, run:
```bash
docker compose up -d
```

Next run:
```bash
npm install
```

Next, for creating mock data in db:
```bash
npm run init
```

Next, to start the local server:
```bash
npm run dev
```

# Assignment: Instapoke
Create a React component for displaying an image feed (like in Instagram). Loading new feed items should occur on scroll.

You also need to create a simple server that will allow getting images page by page. You can use any programming language or any ready-made server (this part of the task will not be evaluated, however, if you make a convenient and beautiful API this will be a plus).

We expect production-level code quality.
Requirements:
* You cannot use ready-made libraries for implementing infinite scroll
* Implementation time is not limited, however, we expect the task to be completed within a reasonable timeframe (several weeks)
* The project should be implemented in TypeScript
* We do not provide a design mockup, therefore we will not evaluate the quality of the design
* Image source is arbitrary, for example, you can use https://github.com/PokeAPI/sprites/tree/master
* Image size is fixed (you can choose any size, depending on the image source you choose)
* New images are dynamically loaded on scroll
* Optional part: If the server can provide search by image meta-information (hashtags), then searching by them is required. Required part: If the server API does not support this, the code should be designed so that this functionality can be added in the future
* The component should be performant, we will test it by scrolling through a large number of feed items
