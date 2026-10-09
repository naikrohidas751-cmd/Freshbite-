FROM eclipse-temurin:21-jdk

WORKDIR /app/backend-java
COPY backend-java/src ./src
COPY backend-java/admin.html ./admin.html
COPY backend-java/admin.js ./admin.js
COPY frontend /app/frontend

RUN javac --add-modules jdk.httpserver -d out src/Main.java

ENV PORT=10000
EXPOSE 10000
CMD ["java", "--add-modules", "jdk.httpserver", "-cp", "out", "Main"]