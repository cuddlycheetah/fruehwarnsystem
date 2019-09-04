const { Sequelize, Model } = require('sequelize')

class LightningCell extends Model {}
class LightningEvent extends Model {}

const sequelize = new Sequelize({
    database: 'safetygram',
    dialect: 'sqlite',
    storage: ':memory:',
    define: {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: true
    },
    models: [
        LightningCell,
        LightningEvent,
    ],
});

LightningCell.init({
    id: { type: Sequelize.INTEGER, unique: true, autoIncrement: true, primaryKey: true },
    /*type: Sequelize.ENUM(
        'chatTypePrivate',
        'chatTypeBasicGroup',
        'chatTypeSupergroup',
    ),*/
    lcCount: { type: Sequelize.INTEGER, defaultValue: 0 },

    lat: { type: Sequelize.FLOAT },
    lng: { type: Sequelize.FLOAT },

    time: Sequelize.DATE,
}, {
    timestamps: false,
    sequelize,
    modelName: 'cell'
})
LightningEvent.init({
    id: { type: Sequelize.INTEGER, unique: true, autoIncrement: true, primaryKey: true },
    cellId: { type: Sequelize.INTEGER },
    deviation: Sequelize.INTEGER,
    delay: Sequelize.INTEGER,

    lat: { type: Sequelize.FLOAT },
    lng: { type: Sequelize.FLOAT },

    time: Sequelize.DATE,
    // hash: Sequelize.STRING,
    // name: Sequelize.TEXT,
    // photo: Sequelize.STRING,
}, {
    timestamps: false,
    sequelize,
    modelName: 'event'
})
LightningCell.hasMany(LightningEvent);
LightningEvent.belongsTo(LightningCell, { foreignKey: 'cellId' })


exports.LightningEvent = LightningEvent
exports.LightningCell = LightningCell

exports.sequelize = sequelize
