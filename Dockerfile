FROM node:carbon

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npm install -g pm2

COPY src /app

EXPOSE 8005

#RUN npm install pm2 -g --no-optional

#CMD [ "pm2", "start", "index.js" ]
#CMD [ "node", "index.js" ]
CMD ["pm2-runtime", "index.js"]