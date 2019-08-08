var express = require('express');
var graphqlHTTP = require('express-graphql');
var { buildSchema } = require('graphql');
// GraphQL schema
var schema = buildSchema(`

    input OrderInput {
        description: String!
        total: Float!
    },
    input PaymentInput {
        orderId: ID!
        amount: Float!
        note: String
    },
    type Query {
        orders: [Order]
    },
    type Mutation {
        createOrder(input: OrderInput): Order
        applyPayment(input: PaymentInput): Payment
    },
    type Order {
        id: ID!
        description: String!
        total: Float!
        balanceDue: Float!
        paymentsApplied: [Payment!]
    },
    type Payment {
        id: ID!
        amount: Float!
        appliedAt: String!
        note: String
    }

`);

class Order {
    constructor(id, {description, total}) {
        this.id = id;
        this.description = description;
        this.total = total;
        this.balanceDue = total;
        this.paymentsApplied = [];
    }

    applyPayment(params) {
        let newPayment = new Payment(params)
        this.paymentsApplied.push(newPayment)
        this.balanceDue -= newPayment.amount
    }
}

class Payment {
    constructor({amount, note}) {
        this.id = require('crypto').randomBytes(10).toString('hex');
        this.amount = amount;
        this.note = note;
        this.appliedAt = this.getDateTime()
    }

    getDateTime() {
        let dateTime = new Date().toLocaleString().split(' ')
        let date = dateTime[0].slice(0,-1)
        let time = dateTime[1].slice(0,-3)
        let AMPM = dateTime[2]
        return `${time} ${AMPM} ${date}`
    }
}

var ordersData = []
var orderIdLookup = {};

var root = {
    orders: () => {
        return ordersData;
    },
    createOrder: ({input}) => {        
        let id = require('crypto').randomBytes(10).toString('hex');
        while (orderIdLookup[id]) {
            id = require('crypto').randomBytes(10).toString('hex');
        }
        orderIdLookup[id] = true;
        let newOrder = new Order(id, input)
        ordersData.push(newOrder)
        return newOrder
    },
    applyPayment: ({input}) => {
        const {orderId} = input
        if (!orderIdLookup[orderId]) {
            throw new Error(`no order exists with id ${orderId}`)
        }
        ordersData.filter(order => {
            if (order.id === orderId) {
                order.applyPayment(input)
                return order
            }
        })
    }
};

var app = express();
app.use('/graphql', graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
}));
app.listen(4000);
console.log('Running a GraphQL API server at localhost:4000/graphql');