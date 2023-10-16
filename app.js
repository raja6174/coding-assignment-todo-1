const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const { addDays, format, isValid } = require("date-fns");
const path = require("path");
const dbPath = path.join(__dirname, "todoApplication.db");

const app = express();
app.use(express.json());
let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000);
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDbAndServer();

//Snake to Camel Case
const snakeToCamelCase = (dbObject) => {
  return {
    id: dbObject.id,
    todo: dbObject.todo,
    priority: dbObject.priority,
    status: dbObject.status,
    category: dbObject.category,
    dueDate: dbObject.due_date,
  };
};

//Valid Values
const validStatus = ["TO DO", "IN PROGRESS", "DONE"];
const validPriority = ["HIGH", "MEDIUM", "LOW"];
const validCategory = ["WORK", "HOME", "LEARNING"];

//Checking Valid Or Invalid Query Parameters
const hasStatus = (requestQuery) => {
  return (
    requestQuery.status !== undefined &&
    validStatus.includes(requestQuery.status)
  );
};

const hasPriority = (requestQuery) => {
  return (
    requestQuery.priority !== undefined &&
    validPriority.includes(requestQuery.priority)
  );
};

const hasCategory = (requestQuery) => {
  return (
    requestQuery.category !== undefined &&
    validCategory.includes(requestQuery.category)
  );
};

const hasPriorityAndStatus = (requestQuery) => {
  return requestQuery.priority && requestQuery.status;
};

const hasCategoryAndStatus = (requestQuery) => {
  return requestQuery.category && requestQuery.status;
};

const hasCategoryAndPriority = (requestQuery) => {
  return requestQuery.category && requestQuery.priority;
};

const hasSearch = (requestQuery) => {
  return requestQuery.search_q !== undefined;
};

//API 1
app.get("/todos/", async (request, response) => {
  let getTodoQuery;
  let data = null;
  const { search_q, status, category, priority } = request.query;
  switch (true) {
    case hasStatus(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            status = '${status}' 
          `;
      break;

    case hasPriority(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            priority = '${priority}'
          `;
      break;

    case hasCategory(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            category = '${category}'
          `;
      break;

    case hasPriorityAndStatus(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            status = '${status}' AND priority = '${priority}' 
          `;
      break;

    case hasCategoryAndStatus(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            status = '${status}' AND category = '${category}' 
          `;
      break;
    case hasCategoryAndPriority(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            category = '${category}' AND todo LIKE "%${search_q}%" 
          `;
      break;

    case hasSearch(request.query):
      getTodoQuery = `
          SELECT * 
          FROM
            todo
          WHERE 
            todo LIKE "%${search_q}%"
          `;
      break;

    case JSON.stringify(request.query) === "{}":
      getTodoQuery = `
          SELECT * 
          FROM
            todo;
          `;
      break;
  }

  let query;
  const requestQuery = request.query;

  switch (true) {
    case requestQuery.status !== undefined:
      query = "Status";
      break;
    case requestQuery.priority !== undefined:
      query = "Priority";
      break;
    case requestQuery.category !== undefined:
      query = "Category";
      break;
  }

  if (getTodoQuery === undefined) {
    response.status(400);
    response.send(`Invalid Todo ${query}`);
  } else {
    data = await db.all(getTodoQuery);
    response.send(data.map((eachItem) => snakeToCamelCase(eachItem)));
  }
});

//API 2
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;

  const getTodo = `
    SELECT * 
    FROM
    todo
    WHERE 
        id = ${todoId};
    `;

  const todo = await db.get(getTodo);
  response.send(snakeToCamelCase(todo));
});

//API 3
app.get("/agenda/", async (request, response) => {
  let { date } = request.query;
  let newDate = new Date(date);
  const validDate = (year, month, day) => isValid(new Date(year, month, day));
  const isTrue = validDate(
    newDate.getFullYear(),
    newDate.getMonth(),
    newDate.getDate()
  );
  if (isTrue) {
    const formattedDate = format(newDate, "yyyy-MM-dd");
    const getQuery = `
      SELECT * 
      FROM todo WHERE due_date = '${formattedDate}';
      `;

    const todos = await db.all(getQuery);
    response.send(todos.map((eachItem) => snakeToCamelCase(eachItem)));
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

//API 4
app.post("/todos/", async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const requestBody = request.body;
  switch (true) {
    case requestBody.status !== undefined:
      updatedColumn = "Status";
      if (!validStatus.includes(requestBody.status)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
    case requestBody.priority !== undefined:
      updatedColumn = "Priority";
      if (!validPriority.includes(requestBody.priority)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
    case requestBody.todo !== undefined:
      updatedColumn = "Todo";
    case requestBody.category !== undefined:
      updatedColumn = "Category";
      if (!validCategory.includes(requestBody.category)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
    case requestBody.dueDate !== undefined:
      updatedColumn = "Due Date";
      if (!isValid(new Date(dueDate))) {
        response.status(400);
        response.send(`Invalid ${updatedColumn}`);
      }
  }

  const createTodQuery = `
    INSERT INTO 
    todo (id, todo, priority, status, category, due_date)
    VALUES(
        ${id}, '${todo}', '${priority}', '${status}', '${category}', '${dueDate}'
    )

    `;

  await db.run(createTodQuery);
  if (response.statusCode !== 400) {
    response.send("Todo Successfully Added");
  }
});

//API 5
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getCurrentTodo = `
    SELECT * 
    FROM 
        todo
    WHERE 
        id = ${todoId};
    `;

  const currentTodo = await db.get(getCurrentTodo);

  const {
    status = currentTodo.status,
    priority = currentTodo.priority,
    todo = currentTodo.todo,
    category = currentTodo.category,
    dueDate = currentTodo.due_date,
  } = request.body;
  const requestBody = request.body;
  let updatedColumn;

  switch (true) {
    case requestBody.status !== undefined:
      updatedColumn = "Status";
      if (!validStatus.includes(requestBody.status)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.priority !== undefined:
      updatedColumn = "Priority";
      if (!validPriority.includes(requestBody.priority)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.todo !== undefined:
      updatedColumn = "Todo";
      break;
    case requestBody.category !== undefined:
      updatedColumn = "Category";
      if (!validCategory.includes(requestBody.category)) {
        response.status(400);
        response.send(`Invalid Todo ${updatedColumn}`);
      }
      break;
    case requestBody.dueDate !== undefined:
      updatedColumn = "Due Date";
      if (!isValid(new Date(dueDate))) {
        response.status(400);
        response.send(`Invalid ${updatedColumn}`);
      }
      break;
  }
  if (response.statusCode !== 400) {
    const updateQuery = `
        UPDATE todo
        SET 
            status = '${status}',
            priority = '${priority}',
            todo = '${todo}',
            category = '${category}',
            due_date = '${dueDate}'
        WHERE 
            id = ${todoId}
        `;

    await db.run(updateQuery);
    response.send(`${updatedColumn} Updated`);
  }
});

//API 6
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteQuery = `
    DELETE FROM 
        todo
    WHERE 
        id = ${todoId}
    `;
  await db.run(deleteQuery);
  response.send("Todo Deleted");
});

module.exports = app;
