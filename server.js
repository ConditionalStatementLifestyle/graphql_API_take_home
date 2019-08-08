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
    input OrderPayInput {
        description: String!
        total: Float!
        paymentAmount: Float!
        note: String
    },
    type Query {
        orders: [Order]
    },
    type Mutation {
        createOrder(input: OrderInput): Order
        applyPayment(input: PaymentInput): Payment
        placeOrderAndPay(input: OrderPayInput): Order
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

// ********************* Order & Payment Classes *********************
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
        return `${time}${AMPM} ${date}`
    }
}

// ********************* array to hold all orders *********************
var ordersData = []
// ********************* object to hold all order ids *********************
// This gives us O(1) time complexity when checking to see if order exists.
// Optimally ordersData would be an object as well but I had trouble implementing this.
// Might be able to get around array requirement by nesting a single object inside of an array
// although that solution seems messy.
var orderIdLookup = {};

// ********************* helper function to create order *********************
handleCreateOrder = (input) => {
    let id = require('crypto').randomBytes(10).toString('hex');
    while (orderIdLookup[id]) {
        id = require('crypto').randomBytes(10).toString('hex');
    }
    orderIdLookup[id] = true;
    let newOrder = new Order(id, input)
    ordersData.push(newOrder)
    return newOrder
}

// ********************* helper function to handle order payment *********************
handleApplyPayment = (input) => {
    const {orderId, amount} = input
    if (!orderIdLookup[orderId]) {
        throw new Error(`no order exists with id ${orderId}`)
    }
    ordersData.filter(order => {
        if (order.id === orderId) {
            if (order.balanceDue === 0) {
                throw new Error("There is no balance due on this order.")
            }
            else if (order.balanceDue < amount) {
                throw new Error(`The applied payment of $${amount} exceeds the balance due ($${order.balanceDue}). Please resubmit the payment.`)
            }
            else {
                order.applyPayment(input)
                return order
            }
        }
    })
}

var root = {
    orders: () => {
        return ordersData;
    },
    createOrder: ({input}) => {      
        return handleCreateOrder(input)
    },
    applyPayment: ({input}) => {
        return handleApplyPayment(input)
    },
    placeOrderAndPay: ({input}) => {
        let {description, total, paymentAmount, note} = input
        let order = handleCreateOrder({description: description, total: total})
        handleApplyPayment({orderId: order.id, amount: paymentAmount, note: note})
        return order
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

